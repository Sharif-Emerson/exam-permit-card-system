export type FaqItem = { question: string; answer: string }

export const FAQ_STORAGE_KEY = 'kiu-faq-items'

export const defaultFaqs: FaqItem[] = [
  {
    question: 'What is an exam permit?',
    answer: 'An exam permit is an official document that allows you to sit for university exams after meeting all requirements.',
  },
  {
    question: 'How do I apply for a permit?',
    answer: 'Go to the dashboard, click "Apply for Permit", and follow the instructions.',
  },
  {
    question: 'Why is my permit status pending?',
    answer: 'Your application is under review or you have outstanding requirements (e.g., unpaid fees).',
  },
  {
    question: 'How do I download or print my permit?',
    answer: 'Once approved, you will see Download and Print buttons on your permit card.',
  },
  {
    question: 'Who can I contact for help?',
    answer: 'Use the Help & Support section in the sidebar for guidance and contact information.',
  },
]

export function loadFaqs(): FaqItem[] {
  try {
    const raw = localStorage.getItem(FAQ_STORAGE_KEY)
    if (!raw) return defaultFaqs
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaultFaqs
    const cleaned = (parsed as unknown[]).filter(
      (item): item is FaqItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).question === 'string' &&
        typeof (item as Record<string, unknown>).answer === 'string',
    )
    return cleaned.length > 0 ? cleaned : defaultFaqs
  } catch {
    return defaultFaqs
  }
}

export function saveFaqs(faqs: FaqItem[]): void {
  localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(faqs))
  window.dispatchEvent(new Event('kiu-faq-updated'))
}
