"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * 끌어다 놓기 영역. 안에 기존 업로드 버튼을 그대로 감싸면,
 * 클릭 업로드는 유지하고 드롭도 받는다.
 *
 * accept: 파일 인풋과 같은 문자열(".pdf", "image/*", ".xlsx,.xls").
 * 드롭된 파일 중 accept 에 맞는 것만 onFiles 로 넘긴다.
 */
export function DropZone({
  accept = "",
  multiple = false,
  disabled = false,
  onFiles,
  className,
  overlayText,
  children,
}: {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
  className?: string
  overlayText?: string
  children: ReactNode
}) {
  const [over, setOver] = useState(false)

  const rules = accept
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  function matches(file: File): boolean {
    if (rules.length === 0) return true
    const name = file.name.toLowerCase()
    const type = file.type.toLowerCase()
    return rules.some((rule) => {
      if (rule.startsWith(".")) return name.endsWith(rule)
      if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1))
      return type === rule
    })
  }

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        // 자식으로 이동하는 dragleave 는 무시
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setOver(false)
      }}
      onDrop={(e) => {
        if (disabled) return
        e.preventDefault()
        setOver(false)
        const dropped = Array.from(e.dataTransfer.files).filter(matches)
        if (dropped.length === 0) return
        onFiles(multiple ? dropped : [dropped[0]])
      }}
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-colors",
        over ? "border-primary bg-primary/5" : "border-transparent",
        className,
      )}
    >
      {children}
      {over && overlayText && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-primary/5 text-sm font-medium text-primary">
          {overlayText}
        </div>
      )}
    </div>
  )
}
