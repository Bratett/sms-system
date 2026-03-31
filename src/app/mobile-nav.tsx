"use client";

import { useState } from "react";
import Link from "next/link";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Toggle navigation menu"
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-gray-200 bg-white shadow-lg">
          <div className="space-y-1 px-4 py-4">
            <a
              href="#features"
              onClick={() => setIsOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              Features
            </a>
            <a
              href="#admissions"
              onClick={() => setIsOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              Admissions
            </a>
            <Link
              href="/apply"
              onClick={() => setIsOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              Standard Application
            </Link>
            <Link
              href="/apply"
              onClick={() => setIsOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              CSSPS Placement
            </Link>
            <a
              href="#contact"
              onClick={() => setIsOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              Contact
            </a>
            <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
              <Link
                href="/login"
                className="block w-full rounded-md border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Sign In
              </Link>
              <Link
                href="/apply"
                className="block w-full rounded-md bg-[#0d9488] px-4 py-2 text-center text-sm font-medium text-white hover:bg-[#0f766e]"
              >
                Apply Now
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
