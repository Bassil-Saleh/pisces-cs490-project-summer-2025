import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx}", // Include all files in the src directory
    ],
    theme: {
        extend: {
            colors: {
                background: {
                    DEFAULT: "#f8fafc", // Modern Light theme background
                    dark: "#0f172a", // Modern Dark theme background
                    purple: "#faf5ff", // Purple theme background
                },
                foreground: {
                    DEFAULT: "#1e293b", // Modern Light theme text
                    dark: "#f1f5f9", // Modern Dark theme text
                    purple: "#581c87", // Purple theme text
                },
            },
        },
    },
    darkMode: ["class", '[data-mode="dark"]'], // Enable dark mode using the "class" strategy
    plugins: [
        function({ addVariant }: { addVariant: (name: string, selector: string) => void }) {
            addVariant('purple', '.purple &')
        }
    ],
};

export default config;