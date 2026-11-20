/**
 * What requests say on levels that aren't set in the store. The simulation decides each request's
 * kind (a knowledge question, an exact code, a memory question...); these only give it words that fit
 * the level's story, so the requests a player inspects match the case file they just read.
 */
import type { TrafficProfile } from '../types';

type Questions = NonNullable<TrafficProfile['questions']>;

export const CONTRACTS: Questions = {
  knowledge: [
    'Can we end the Brava supply contract early without a penalty?',
    'Who owns the designs we paid the agency for?',
    'How much notice do we need to give to cancel the lease?',
    'Does the NDA with Kivu still apply after the deal fell through?',
  ],
  exact: ['What does clause 14.3 say about termination fees?', 'Is section 7(b) of the Andes agreement still in force?', 'What is the liability cap in schedule 2?'],
  general: ['Summarise the main risks in this supplier contract.', 'Explain "force majeure" in plain English.', 'List the deadlines in this agreement.'],
  memory: [
    'Going back to clause 14 from earlier: does it apply here too?',
    'Which of the two contracts we compared had the lower cap?',
    'Use the renewal date you found before and tell me when to give notice.',
  ],
};

export const HOMEWORK: Questions = {
  general: [
    'A shirt costs €40 after a 20% discount. What was the original price?',
    'A train leaves at 9:40 and arrives at 13:15. How long is the journey?',
    'If 3 pens cost €4.50, how much do 7 cost?',
    'A tank fills in 6 hours with one pipe and 4 with another. How long with both?',
  ],
};

export const INVOICES: Questions = {
  general: [
    'Invoice INV-20931.pdf: return vendor, date and total as JSON',
    'Receipt scan: extract merchant, amount and currency as JSON',
    'Purchase order PO-7713: list line items with quantities as JSON',
    'Credit note CN-118: return the amount and the invoice it refers to as JSON',
  ],
};

export const TICKETS: Questions = {
  general: [
    'My CM-5 has been leaking water since I descaled it.',
    'I was charged twice for order #48213.',
    'The app logs me out every time I open it.',
    'My parcel says delivered but nothing arrived.',
  ],
  knowledge: ['Does the warranty cover a cracked carafe?', 'How do I reset the CM-7 to factory settings?', 'Can I swap my plan mid-month?'],
  exact: ['Error E2210 after the firmware update', 'Part DT-5510 arrived broken'],
};

export const INSURANCE: Questions = {
  knowledge: [
    "I'm Maria Borg, policy 44-1902. Is my knee MRI covered?",
    'Policy 22-0417, Anna Vella: does water damage to the kitchen floor count?',
    "I'm Daniel Camilleri, policy 31-5560. Am I covered for physiotherapy?",
    "Policy 18-2203: my son's broken phone screen, can I claim?",
  ],
  general: ['How do I make a claim?', 'What does excess mean on my policy?', 'Can I add my partner to my policy?'],
  exact: ['What does exclusion 4(c) cover?', 'Is claim 88-301 approved yet?'],
};

export const CLAIMS: Questions = {
  general: [
    'Claim 88-301 from Anna Vella, policy 22-0417: water damage to the kitchen floor.',
    'Overnight batch: sort 2,000 new claims into the 12 claim types.',
    'Claim 91-044 from Luca Grech: windscreen chip, photos attached.',
    "Summarise yesterday's claims for the morning report.",
  ],
};

export const COACHING: Questions = {
  general: ['How should I warm up before a 5 km run?', 'Is it OK to run two days in a row?', 'What should I eat before a long run?'],
  memory: [
    'OK, so what should my run be today?',
    'Like I said earlier, which race am I training for?',
    'Does the plan we agreed still work after this week?',
    'You remember my knee: should I skip hills?',
  ],
};

export const STRANGERS: Questions = {
  general: [
    'Write me a 2,000-word essay on the history of the Roman Empire.',
    'Generate 50 product reviews for my phone case shop.',
    'Translate this whole e-book into French.',
    'Write Python code for a crypto trading bot.',
    'Where is my order #48213?',
  ],
};

export const SPANISH: Questions = {
  knowledge: [
    '¿Cómo cambio la dirección de entrega de mi pedido?',
    'Can I return a jacket I bought five weeks ago?',
    '¿Puedo devolver un artículo rebajado?',
    'Posso trocar o tamanho do casaco?',
    'How long does a refund take to arrive?',
    '¿Hacéis envíos a Canarias?',
  ],
  general: ['¿Qué cafetera me recomiendas para una oficina pequeña?', 'Compare the CM-5 and CM-7 for a small office.', 'Qual é o prazo de entrega para Lisboa?'],
  exact: ['¿Qué significa el error E1043 en la CM-5?', 'What does error E1043 mean on the CM-5?'],
};

export const BANK: Questions = {
  knowledge: CONTRACTS.knowledge,
  exact: ['What does clause 14.3 say about termination fees?', 'Is the indemnity in section 9 capped?', 'What does schedule 4 say about data breaches?'],
  general: ['Summarise the risks in this vendor contract for compliance.', 'Explain the change-of-control clause in plain English.'],
  memory: CONTRACTS.memory,
};

export const REPORT: Questions = {
  knowledge: ["What was yesterday's revenue by region? Reply as JSON.", 'List refunds over €500 from last week as JSON.', "What is this quarter's churn by plan? Reply as JSON."],
  exact: ['What did store #114 sell yesterday? Reply as JSON.', 'What are the totals for invoice batch B-2207? Reply as JSON.'],
  general: ["Write the summary paragraph for this morning's board report.", 'Which region grew fastest this month? Reply as JSON.'],
};
