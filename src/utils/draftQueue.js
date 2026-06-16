const DRAFT_KEY_PREFIX = 'workout_draft_'

export function saveDraft(uid, workout) {
  const drafts = getDrafts(uid)
  const draftWithMeta = {
    ...workout,
    _draftId: crypto.randomUUID(),
    _pendingSync: true,
    _draftCreatedAt: Date.now(),
  }
  drafts.push(draftWithMeta)
  localStorage.setItem(DRAFT_KEY_PREFIX + uid, JSON.stringify(drafts))
  return draftWithMeta
}

export function getDrafts(uid) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + uid)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function removeDraft(uid, draftId) {
  const drafts = getDrafts(uid).filter(d => d._draftId !== draftId)
  localStorage.setItem(DRAFT_KEY_PREFIX + uid, JSON.stringify(drafts))
}

export async function syncDrafts(uid, saveWorkoutFn) {
  const drafts = getDrafts(uid)
  if (!drafts.length) return { synced: 0, failed: 0 }
  let synced = 0, failed = 0
  for (const draft of drafts) {
    try {
      const { _draftId, _pendingSync, _draftCreatedAt, ...workoutData } = draft
      await saveWorkoutFn(workoutData)
      removeDraft(uid, _draftId)
      synced++
    } catch {
      failed++
    }
  }
  return { synced, failed }
}
