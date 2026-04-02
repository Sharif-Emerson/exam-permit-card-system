import '@testing-library/jest-dom/vitest'

/** Desktop width so Tailwind `lg:` applies (sidebar visible) in jsdom. */
Object.defineProperty(window, 'innerWidth', {
	writable: true,
	configurable: true,
	value: 1280,
})

Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => {
		const minW = query.match(/\(\s*min-width:\s*(\d+)px\s*\)/)
		const maxW = query.match(/\(\s*max-width:\s*(\d+)px\s*\)/)
		let matches = false
		if (minW) {
			matches = window.innerWidth >= Number(minW[1])
		} else if (maxW) {
			matches = window.innerWidth <= Number(maxW[1])
		}
		return {
			matches,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}
	},
})