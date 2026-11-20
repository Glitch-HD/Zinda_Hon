// The decision engine (Challenges 01, 02, 04, 05).
// Pure function: same inputs + same rule version => same decision. No AI model decides here;
// AI produces the check scores, and this code applies the admin's current rule version to them.
// The system can APPROVE, ASK_MORE_PROOF, or SEND_TO_OFFICER. It never stops a pension on its own.

export type RuleConfig = {
  costs: { wrongApprovalPkr: number; humanReviewPkr: number };
  face: { strictDistance: number; looseDistance: number; reliabilityWhenStrict: number };
  liveness: { reliabilityWhenPassed: number };
  document: { reliabilityWhenValid: number; required: boolean };
  identity: { autoMinSimilarity: number; askMinSimilarity: number; reliabilityWhenMatched: number };
  deathRegistry: { reliabilityWhenClear: number };
  anomaly: { maxAgeYears: number };
  maxAttempts: number;
};

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  costs: { wrongApprovalPkr: 360000, humanReviewPkr: 2000 },
  // face-api descriptors: Euclidean distance, lower = more alike. Starting values; tuned on our test faces.
  face: { strictDistance: 0.4, looseDistance: 0.55, reliabilityWhenStrict: 0.998 },
  liveness: { reliabilityWhenPassed: 0.999 },
  document: { reliabilityWhenValid: 0.9995, required: true },
  identity: { autoMinSimilarity: 0.92, askMinSimilarity: 0.8, reliabilityWhenMatched: 0.9995 },
  deathRegistry: { reliabilityWhenClear: 0.9995 },
  anomaly: { maxAgeYears: 100 },
  maxAttempts: 2,
};

export type DecisionInputs = {
  face: { distance: number; attempts: number } | null;
  liveness: { passed: boolean; attempts: number } | null;
  document: { qrValid: boolean | null; fieldsMatch: boolean | null; attempts: number } | null;
  identity: {
    nameSimilarity: number;
    cnicMatch: boolean | null; // null = CNIC missing in one of the records
    dobMatch: boolean | null;
    duplicateRecords: number;
  };
  deathRecordFound: boolean;
  ageYears: number | null;
  anomalies: string[];
};

export type CheckResult = {
  check: string;
  status: "pass" | "weak" | "fail" | "missing";
  score: number | null;
  detail: string;
};

export type DecisionResult = {
  outcome: "APPROVE" | "ASK_MORE_PROOF" | "SEND_TO_OFFICER";
  confidence: number; // estimated probability the approval would be correct
  requiredConfidence: number;
  checks: CheckResult[];
  redFlags: string[];
  askFor: string[]; // which proof to retake
  reasonEn: string;
  reasonUr: string;
  priority: number; // for the officer queue: higher = look sooner
};

/** Auto-approve only if P(wrong) x cost of wrong approval < cost of a human review. */
export function requiredConfidence(config: RuleConfig): number {
  const { wrongApprovalPkr, humanReviewPkr } = config.costs;
  if (wrongApprovalPkr <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - humanReviewPkr / wrongApprovalPkr));
}

const ASK_TEXT: Record<string, { en: string; ur: string }> = {
  selfie: { en: "take a new selfie in good light", ur: "روشنی میں دوبارہ اپنی تصویر لیں" },
  liveness: { en: "repeat the blink and head-turn check", ur: "آنکھ جھپکنے اور سر گھمانے والا مرحلہ دوبارہ کریں" },
  document: { en: "take a clearer photo of the pension book", ur: "پنشن بک کی صاف تصویر دوبارہ لیں" },
  name_confirm: { en: "confirm your name and your husband's or father's name by voice", ur: "آواز کے ذریعے اپنا اور اپنے شوہر یا والد کا نام بتائیں" },
};

export function decide(inputs: DecisionInputs, config: RuleConfig = DEFAULT_RULE_CONFIG): DecisionResult {
  const checks: CheckResult[] = [];
  const redFlags: string[] = [];
  const askFor: string[] = [];
  let confidence = 1;

  // 1. Death registry: any record is a red flag, always a human decision.
  if (inputs.deathRecordFound) {
    redFlags.push("death_record_found");
    checks.push({ check: "death_registry", status: "fail", score: null, detail: "A death record matches this person" });
  } else {
    checks.push({ check: "death_registry", status: "pass", score: null, detail: "No matching death record" });
    confidence *= config.deathRegistry.reliabilityWhenClear;
  }

  // 2. Face match.
  const face = inputs.face;
  if (!face) {
    checks.push({ check: "face_match", status: "missing", score: null, detail: "No selfie yet" });
    askFor.push("selfie");
    confidence = 0;
  } else if (face.distance <= config.face.strictDistance) {
    checks.push({ check: "face_match", status: "pass", score: face.distance, detail: "Face closely matches the enrolled face" });
    confidence *= config.face.reliabilityWhenStrict;
  } else if (face.distance <= config.face.looseDistance) {
    checks.push({ check: "face_match", status: "weak", score: face.distance, detail: "Face match is uncertain" });
    if (face.attempts < config.maxAttempts) askFor.push("selfie");
    else redFlags.push("face_uncertain_after_retakes");
    confidence = 0;
  } else {
    checks.push({ check: "face_match", status: "fail", score: face.distance, detail: "Face does not match the enrolled face" });
    if (face.attempts < config.maxAttempts) askFor.push("selfie");
    else redFlags.push("face_mismatch");
    confidence = 0;
  }

  // 3. Liveness.
  const live = inputs.liveness;
  if (!live) {
    checks.push({ check: "liveness", status: "missing", score: null, detail: "Liveness check not done yet" });
    askFor.push("liveness");
    confidence = 0;
  } else if (live.passed) {
    checks.push({ check: "liveness", status: "pass", score: null, detail: "Blinked and turned head on request" });
    confidence *= config.liveness.reliabilityWhenPassed;
  } else {
    checks.push({ check: "liveness", status: "fail", score: null, detail: "Did not complete the requested movements" });
    if (live.attempts < config.maxAttempts) askFor.push("liveness");
    else redFlags.push("liveness_failed");
    confidence = 0;
  }

  // 4. Pension book (signed QR + printed fields).
  const doc = inputs.document;
  if (!doc) {
    if (config.document.required) {
      checks.push({ check: "document", status: "missing", score: null, detail: "Pension book not scanned yet" });
      askFor.push("document");
      confidence = 0;
    }
  } else if (doc.qrValid === false || doc.fieldsMatch === false) {
    redFlags.push(doc.qrValid === false ? "document_signature_invalid" : "document_fields_edited");
    checks.push({ check: "document", status: "fail", score: null, detail: "Pension book QR signature or printed details do not match records" });
    confidence = 0;
  } else if (doc.qrValid === null) {
    checks.push({ check: "document", status: "weak", score: null, detail: "Pension book QR could not be read" });
    if (doc.attempts < config.maxAttempts) askFor.push("document");
    else redFlags.push("document_unreadable");
    confidence = 0;
  } else {
    checks.push({ check: "document", status: "pass", score: null, detail: "Pension book QR signature is valid and details match" });
    confidence *= config.document.reliabilityWhenValid;
  }

  // 5. Identity across mock NADRA, pension and bank records.
  const id = inputs.identity;
  if (id.cnicMatch === false) {
    redFlags.push("cnic_mismatch");
    checks.push({ check: "identity", status: "fail", score: id.nameSimilarity, detail: "CNIC differs between records" });
    confidence = 0;
  } else if (id.duplicateRecords > 0) {
    redFlags.push("duplicate_person_records");
    checks.push({ check: "identity", status: "fail", score: id.nameSimilarity, detail: `${id.duplicateRecords} other record(s) look like the same person` });
    confidence = 0;
  } else if (id.cnicMatch === null && id.dobMatch !== true) {
    redFlags.push("identity_unconfirmed_missing_cnic");
    checks.push({ check: "identity", status: "fail", score: id.nameSimilarity, detail: "CNIC missing and date of birth does not confirm identity" });
    confidence = 0;
  } else if (id.nameSimilarity >= config.identity.autoMinSimilarity) {
    checks.push({ check: "identity", status: "pass", score: id.nameSimilarity, detail: "Name and CNIC agree across records" });
    confidence *= config.identity.reliabilityWhenMatched;
  } else if (id.nameSimilarity >= config.identity.askMinSimilarity) {
    checks.push({ check: "identity", status: "weak", score: id.nameSimilarity, detail: "Name spelling differs between records" });
    askFor.push("name_confirm");
    confidence = 0;
  } else {
    redFlags.push("name_mismatch");
    checks.push({ check: "identity", status: "fail", score: id.nameSimilarity, detail: "Names in the records do not match" });
    confidence = 0;
  }

  // 6. Anomalies (ghost-pension patterns).
  if (inputs.ageYears !== null && inputs.ageYears > config.anomaly.maxAgeYears) {
    redFlags.push(`age_over_${config.anomaly.maxAgeYears}`);
  }
  for (const a of inputs.anomalies) redFlags.push(a);

  const required = requiredConfidence(config);
  confidence = Math.round(confidence * 100000) / 100000;

  let outcome: DecisionResult["outcome"];
  if (redFlags.length > 0) outcome = "SEND_TO_OFFICER";
  else if (askFor.length > 0) outcome = "ASK_MORE_PROOF";
  else if (confidence >= required) outcome = "APPROVE";
  else outcome = "SEND_TO_OFFICER"; // every check passed but combined certainty is still too low

  const priority =
    (inputs.deathRecordFound ? 50 : 0) +
    (redFlags.some((f) => f.startsWith("document")) ? 30 : 0) +
    (redFlags.includes("face_mismatch") ? 20 : 0) +
    redFlags.length * 5;

  const { reasonEn, reasonUr } = explain(outcome, askFor, redFlags);
  return { outcome, confidence, requiredConfidence: required, checks, redFlags, askFor, reasonEn, reasonUr, priority };
}

function explain(outcome: DecisionResult["outcome"], askFor: string[], redFlags: string[]) {
  if (outcome === "APPROVE") {
    return {
      reasonEn: "All checks passed. Your pension will continue for another year.",
      reasonUr: "تمام جانچ مکمل ہو گئی۔ آپ کی پنشن اگلے ایک سال تک جاری رہے گی۔",
    };
  }
  if (outcome === "ASK_MORE_PROOF") {
    const en = askFor.map((a) => ASK_TEXT[a]?.en).filter(Boolean).join("; ");
    const ur = askFor.map((a) => ASK_TEXT[a]?.ur).filter(Boolean).join("، ");
    return {
      reasonEn: `We need a little more proof: please ${en}. Your pension is not stopped.`,
      reasonUr: `ہمیں تھوڑا مزید ثبوت چاہیے: ${ur}۔ آپ کی پنشن بند نہیں ہوئی۔`,
    };
  }
  return {
    reasonEn: `We are not sure, so a pension officer will check your case (${redFlags.length || 1} item(s) to review). Your pension is not stopped while they check.`,
    reasonUr: "ہمیں پورا یقین نہیں ہے، اس لیے پنشن افسر آپ کا کیس دیکھے گا۔ جانچ کے دوران آپ کی پنشن بند نہیں ہوگی۔",
  };
}
