"use client"

import { NextIntlClientProvider } from "next-intl"
import type { AbstractIntlMessages } from "next-intl"

export function IntlProvider({
  messages,
  children,
}: {
  messages: AbstractIntlMessages
  children: React.ReactNode
}) {
  return (
    <NextIntlClientProvider
      messages={messages}
      onError={() => {}}
      getMessageFallback={({ key }) => key.split(".").at(-1) ?? key}
    >
      {children}
    </NextIntlClientProvider>
  )
}
