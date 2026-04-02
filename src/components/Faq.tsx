import React from 'react';

const faqs = [
  {
    question: 'What is an exam permit?',
    answer: 'An exam permit is an official document that allows you to sit for university exams after meeting all requirements.'
  },
  {
    question: 'How do I apply for a permit?',
    answer: 'Go to the dashboard, click "Apply for Permit", and follow the instructions.'
  },
  {
    question: 'Why is my permit status pending?',
    answer: 'Your application is under review or you have outstanding requirements (e.g., unpaid fees).'
  },
  {
    question: 'How do I download or print my permit?',
    answer: 'Once approved, you will see Download and Print buttons on your permit card.'
  },
  {
    question: 'Who can I contact for help?',
    answer: 'Use the Help & Support section in the sidebar for guidance and contact information.'
  },
];

export default function Faq() {
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
  );
}
