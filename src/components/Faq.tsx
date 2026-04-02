import React from 'react'
import { loadFaqs } from './faqStorage'
import type { FaqItem } from './faqStorage'

export default function Faq() {
  const [faqs, setFaqs] = React.useState<FaqItem[]>(() => loadFaqs())

  React.useEffect(() => {
    const handler = () => setFaqs(loadFaqs())
    window.addEventListener('kiu-faq-updated', handler)
    return () => window.removeEventListener('kiu-faq-updated', handler)
  }, [])

  return (
    <section className="max-w-2xl mx-auto my-10 p-6 rounded-2xl bg-white shadow dark:bg-slate-900">
      <h2 className="mb-6 text-2xl font-bold text-emerald-700 dark:text-emerald-300">Frequently Asked Questions</h2>
      <ul className="space-y-5">
        {faqs.map((faq, idx) => (
          <li key={idx}>
            <details className="group rounded-lg border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <summary className="cursor-pointer text-lg font-semibold text-emerald-800 dark:text-emerald-200 group-open:text-emerald-600 dark:group-open:text-emerald-300">
                {faq.question}
              </summary>
              <p className="mt-2 text-slate-700 dark:text-slate-200">{faq.answer}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
