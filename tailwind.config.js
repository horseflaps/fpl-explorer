/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                fpl: {
                    purple: '#37003c',
                    pink: '#e90052',
                    green: '#00ff85',
                    blue: '#04f5ff',
                }
            }
        },
    },
    plugins: [],
}
