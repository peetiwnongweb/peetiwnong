// สูตรคะแนนรายวิชา: แต่ละวิชามีสัดส่วนคะแนนอธิบาย:คะแนนสอบของตัวเอง (ผู้สอนกำหนด รวมกัน 100)
// วิชาที่ไม่สอบอธิบาย (hasExplanation = false) คิดจากคะแนนสอบ 100%

// สัดส่วนที่ใช้จริงของวิชา (ไม่สอบอธิบาย = 0:100)
function effectiveWeights(subject) {
  if (!subject.hasExplanation) return { explanationWeight: 0, achievementWeight: 100 };
  return { explanationWeight: subject.explanationWeight, achievementWeight: subject.achievementWeight };
}

// คะแนนของวิชา 0-100 จากคะแนนดิบที่กรอก (ยังไม่ถ่วงหน่วยกิต)
function subjectPercent(subject, explanationScore, achievementScore) {
  const { explanationWeight, achievementWeight } = effectiveWeights(subject);
  const explanationPart = explanationWeight ? ((explanationScore ?? 0) / subject.explanationMaxScore) * explanationWeight : 0;
  const achievementPart = ((achievementScore ?? 0) / subject.achievementMaxScore) * achievementWeight;
  return explanationPart + achievementPart;
}

function validateSubjectWeights(explanationWeight, achievementWeight) {
  if (!Number.isInteger(explanationWeight) || explanationWeight < 0 || explanationWeight > 100) {
    return 'สัดส่วนคะแนนอธิบายต้องเป็นจำนวนเต็ม 0-100';
  }
  if (!Number.isInteger(achievementWeight) || achievementWeight < 0 || achievementWeight > 100) {
    return 'สัดส่วนคะแนนสอบต้องเป็นจำนวนเต็ม 0-100';
  }
  if (explanationWeight + achievementWeight !== 100) {
    return 'สัดส่วนคะแนนอธิบาย + คะแนนสอบ ต้องรวมกันเท่ากับ 100';
  }
  return null;
}

module.exports = { effectiveWeights, subjectPercent, validateSubjectWeights };
