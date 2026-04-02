export const institutionName = 'Kampala International University (KIU)'

export const institutionLogo = 'https://images.seeklogo.com/logo-png/55/1/kampala-international-university-kiu-logo-png_seeklogo-550306.png'

export const institutionTagline = 'Secure examination permit portal'

export const institutionColors = {
    primary: '#10b981',
    primaryDark: '#059669',
    primaryLight: '#d1fae5',
    secondary: '#fbbf24',
    secondaryDark: '#f59e0b',
    secondaryLight: '#fef3c7',
    accent: '#06b6d4',
    background: '#f0fdf4',
    surface: '#ffffff',
    text: '#064e3b',
    textLight: '#6b7280',
}

export const institutionContact = {
    email: 'exams@kiu.ac.ug',
    phone: '+256 414 266 813',
    website: 'https://www.kiu.ac.ug',
    address: 'Plot 1265 Ggaba Road, Kansanga, Kampala, Uganda',
}

export const socialMedia = {
    facebook: 'https://www.facebook.com/KampalaInternationalUniversity',
    twitter: 'https://twitter.com/kiu_ug',
    instagram: 'https://www.instagram.com/kiu_ug',
    linkedin: 'https://www.linkedin.com/school/kampala-international-university',
}

export const examPermitConfig = {
    printLimitPerMonth: 2,
    /** Raster width/height for PNG; larger modules scan more reliably on phone cameras. */
    qrCodeSize: 320,
    /** Quiet zone in modules; QR spec expects ~4 — values below 3 often fail physical scanners. */
    qrCodeMargin: 4,
    /** Higher correction survives blur, glare, and small on-screen size. */
    qrErrorCorrection: 'Q' as const,
    permitTitle: 'Official Examination Permit',
    permitSubtitle: 'Kampala International University',
}
