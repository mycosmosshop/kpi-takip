import React, { useState, useEffect } from 'react';

// FIX: The `React` namespace is needed for the types in the function signature.
export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            // An empty string or just whitespace is not valid JSON.
            // `null` from getItem means key does not exist.
            // In all these cases, we should fall back to the initial value.
            if (item === null || item.trim() === '') {
                return initialValue;
            }
            return JSON.parse(item);
        } catch (error) {
            // Also return initialValue if parsing fails for any reason
            // (e.g., corrupted data).
            console.error(`Error reading localStorage key “${key}”:`, error);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                // Prevent storing `undefined` which stringifies to "undefined"
                // and causes parsing errors on next load.
                if (storedValue === undefined) {
                    window.localStorage.removeItem(key);
                } else {
                    window.localStorage.setItem(key, JSON.stringify(storedValue));
                }
            }
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setStoredValue];
}
