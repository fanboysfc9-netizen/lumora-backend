import initFirebase from './firebase.service'

type MessageRecord = { role: 'user' | 'assistant'; text: string; mode?: string; createdAt?: any }

class MemoryService {
  private db: any | null = null
  private inMemory: { conversations: Map<string, MessageRecord[]>; profiles: Map<string, any> }

  constructor() {
    try {
      this.db = initFirebase()
    } catch (err) {
      this.db = null
    }

    this.inMemory = { conversations: new Map(), profiles: new Map() }
  }

  async createConversation(userId: string): Promise<string> {
    if (!this.db) {
      const id = `mem_${Date.now()}`
      this.inMemory.conversations.set(id, [])
      return id
    }

    const doc = await this.db.collection('conversations').add({ userId, createdAt: this.db.FieldValue?.serverTimestamp ? this.db.FieldValue.serverTimestamp() : new Date() })
    return doc.id
  }

  async addUserMessage(userId: string, conversationId: string | undefined, text: string, mode?: string) {
    const convId = conversationId ?? (await this.createConversation(userId))

    if (!this.db) {
      const arr = this.inMemory.conversations.get(convId) || []
      arr.push({ role: 'user', text, mode })
      this.inMemory.conversations.set(convId, arr)
      return
    }

    const ref = this.db.collection('conversations').doc(convId).collection('messages')
    await ref.add({ role: 'user', text, mode, createdAt: this.db.FieldValue?.serverTimestamp ? this.db.FieldValue.serverTimestamp() : new Date() })
  }

  async addAIResponse(userId: string, conversationId: string | undefined, formatted: any, mode?: string) {
    const convId = conversationId ?? (await this.createConversation(userId))

    const text = typeof formatted === 'string' ? formatted : JSON.stringify(formatted)

    if (!this.db) {
      const arr = this.inMemory.conversations.get(convId) || []
      arr.push({ role: 'assistant', text, mode })
      this.inMemory.conversations.set(convId, arr)
      return
    }

    const ref = this.db.collection('conversations').doc(convId).collection('messages')
    await ref.add({ role: 'assistant', text, formatted, mode, createdAt: this.db.FieldValue?.serverTimestamp ? this.db.FieldValue.serverTimestamp() : new Date() })
  }

  async getConversationHistory(userId: string, conversationId?: string, limit = 50) {
    if (conversationId) {
      if (!this.db) {
        return this.inMemory.conversations.get(conversationId) || []
      }

      const q = await this.db.collection('conversations').doc(conversationId).collection('messages').orderBy('createdAt', 'asc').limit(limit).get()
      return q.docs.map((d: any) => ({ role: d.data().role, text: d.data().text }))
    }

    // if no conversationId provided, find latest conversation for user
    if (!this.db) {
      // return last 50 messages across any in-memory conversations for this user
      let all: MessageRecord[] = []
      for (const arr of this.inMemory.conversations.values()) {
        all = all.concat(arr)
      }
      return all.slice(-limit)
    }

    const convQ = await this.db.collection('conversations').where('userId', '==', userId).orderBy('createdAt', 'desc').limit(1).get()
    if (convQ.empty) return []
    const convId = convQ.docs[0].id
    const q = await this.db.collection('conversations').doc(convId).collection('messages').orderBy('createdAt', 'asc').limit(limit).get()
    return q.docs.map((d: any) => ({ role: d.data().role, text: d.data().text }))
  }

  async updateUserProfile(userId: string, patch: any) {
    if (!this.db) {
      const existing = this.inMemory.profiles.get(userId) || {}
      this.inMemory.profiles.set(userId, { ...existing, ...patch })
      return
    }

    await this.db.collection('profiles').doc(userId).set(patch, { merge: true })
  }

  async getUserProfile(userId: string) {
    if (!this.db) return this.inMemory.profiles.get(userId) || null
    const doc = await this.db.collection('profiles').doc(userId).get()
    return doc.exists ? doc.data() : null
  }

  async trackWeakTopic(userId: string, topic: string, weight = 1) {
    if (!this.db) {
      const profile = this.inMemory.profiles.get(userId) || { weakTopics: {} }
      profile.weakTopics = profile.weakTopics || {}
      profile.weakTopics[topic] = (profile.weakTopics[topic] || 0) + weight
      this.inMemory.profiles.set(userId, profile)
      return
    }

    const ref = this.db.collection('profiles').doc(userId)
    await this.db.runTransaction(async (tx: any) => {
      const doc = await tx.get(ref)
      const prev = doc.exists ? doc.data().weakTopics || {} : {}
      prev[topic] = (prev[topic] || 0) + weight
      tx.set(ref, { weakTopics: prev }, { merge: true })
    })
  }
}

const memoryService = new MemoryService()
export default memoryService
