"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

interface UnmatchedLog {
  id: string
  deliveryId: string
  eventType: string
  error: string | null
  createdAt: string
}

interface WiseConfigFormProps {
  profileId: string
  apiTokenConfigured: boolean
  unmatchedLogs: UnmatchedLog[]
}

export function WiseConfigForm({
  profileId: initialProfileId,
  apiTokenConfigured,
  unmatchedLogs,
}: WiseConfigFormProps) {
  const t = useTranslations("admin")
  const [profileId, setProfileId] = useState(initialProfileId)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError("")
    try {
      const res = await fetch("/api/admin/wise/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profileId.trim() }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
    } catch {
      setError(t("wiseSaveFail"))
    } finally {
      setSaving(false)
    }
  }

  const handleTestBalance = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/admin/wise/balance")
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed")
      }
      setTestResult(t("wiseTestSuccess"))
    } catch (err) {
      setTestResult(
        `${t("wiseTestFail")}: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("wiseApiConfig")}</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                apiTokenConfigured ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm">
              {apiTokenConfigured ? t("wiseConnected") : t("wiseNotConnected")}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t("wiseProfileId")}
            </label>
            <p className="mb-1 text-xs text-muted-foreground">
              {t("wiseProfileIdHint")}
            </p>
            <input
              type="text"
              value={profileId}
              onChange={(e) => {
                setProfileId(e.target.value)
                setSaved(false)
              }}
              placeholder="12345678"
              className="mt-1 w-full max-w-md rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !profileId.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "..." : t("wiseSave")}
            </button>
            {saved && (
              <span className="text-sm text-green-600">{t("wiseSaved")}</span>
            )}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>

          {/* Test Balance Button */}
          {apiTokenConfigured && profileId.trim() && (
            <div className="border-t pt-4">
              <button
                onClick={handleTestBalance}
                disabled={testing}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {testing ? "..." : t("wiseTestBalance")}
              </button>
              {testResult && (
                <p
                  className={`mt-2 text-sm ${
                    testResult.includes(t("wiseTestSuccess"))
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {testResult}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unmatched Webhook Logs */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("wiseUnmatched")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("wiseUnmatchedDesc")}
        </p>
        {unmatchedLogs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("wiseNoLogs")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium">
                    {t("dateTime")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("wiseWebhookLog")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {unmatchedLogs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{log.deliveryId}</span>
                    </td>
                    <td className="px-3 py-2 text-red-600">{log.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
