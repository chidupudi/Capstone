/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Primary Brand Colors - Fresh & Modern
                'tf-primary': '#06b6d4',      // Cyan - Main brand color
                'tf-primary-light': '#22d3ee',
                'tf-primary-dark': '#0891b2',

                // Secondary Brand Colors - Warm & Inviting
                'tf-secondary': '#f97316',    // Orange - Accent color
                'tf-secondary-light': '#fb923c',
                'tf-secondary-dark': '#ea580c',

                // Accent Colors
                'tf-accent': '#a855f7',       // Violet - Premium feel
                'tf-accent-light': '#c084fc',
                'tf-accent-dark': '#9333ea',

                // Status Colors
                'tf-success': '#10b981',      // Emerald
                'tf-warning': '#f59e0b',      // Amber
                'tf-error': '#f43f5e',        // Rose

                // Neutral Colors
                'tf-dark': '#0f172a',
                'tf-box': '#1e293b',
                'tf-light': '#f8fafc',
            }
        },
    },
    plugins: [],
}
