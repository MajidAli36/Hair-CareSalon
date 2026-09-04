export const BRAND = {
  name: "Hair & Care Salon",
  tagline: "Precision hair care",
  /** Primary location line shown on invoices */
  address: "Rasheed Plaza, Link Wapda Town Road, Gujranwala",
  phonePtcl: "055 4284709",
  phoneMobile: "0306 9208111",
  /** Combined for compact display */
  phone: "PTCL 055 4284709 · 0306 9208111",
  email: "hello@hairandcaresalon.com",
  hours: [
    { days: "Mon – Sat", time: "10:00 AM – 8:00 PM" },
    { days: "Sunday", time: "11:00 AM – 6:00 PM" },
  ],
  social: {
    instagram: "https://instagram.com",
    facebook: "https://facebook.com",
  },
} as const;

export const BOOKING_SLUG = process.env.NEXT_PUBLIC_BOOKING_SLUG ?? "hair-salon";

export const FEATURED_SERVICES = [
  {
    title: "Signature Haircut",
    description: "Precision cuts tailored to your face shape, hair texture, and lifestyle.",
    duration: "45 min",
    from: "Rs 1,500",
    icon: "scissors" as const,
  },
  {
    title: "Color & Highlights",
    description: "Rich tones, balayage, and gloss treatments with premium color lines.",
    duration: "2 hrs",
    from: "Rs 4,500",
    icon: "palette" as const,
  },
  {
    title: "Keratin & Treatment",
    description: "Deep repair, smoothing, and shine for healthier, manageable hair.",
    duration: "90 min",
    from: "Rs 6,000",
    icon: "sparkles" as const,
  },
  {
    title: "Bridal & Styling",
    description: "Elegant updos and styling for your most important occasions.",
    duration: "2 hrs",
    from: "Rs 8,000",
    icon: "crown" as const,
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "The best salon experience I've had. My color turned out exactly how I imagined.",
    name: "Sara Ahmed",
    role: "Regular client",
  },
  {
    quote:
      "Professional, warm, and never rushed. Truly lives up to its name.",
    name: "Fatima Khan",
    role: "VIP member",
  },
  {
    quote:
      "Online booking was seamless and the stylists are incredible. Already booked my next visit.",
    name: "Zainab Malik",
    role: "New client",
  },
];
