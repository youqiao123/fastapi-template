import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink, redirect } from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"

import { LoginService } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const searchSchema = z.object({
  token: z.string().catch(""),
})

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmail,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (!search.token) {
      throw redirect({ to: "/login" })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Verify Email - TPDagent Cloud",
      },
    ],
  }),
})

function VerifyEmail() {
  const { token } = Route.useSearch()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => LoginService.verifyEmail({ requestBody: { token } }),
    onSuccess: (data) => {
      showSuccessToast(data.message || "Email verified successfully")
    },
    onError: handleError.bind(showErrorToast),
  })

  useEffect(() => {
    if (!mutation.isIdle) return
    mutation.mutate()
  }, [mutation])

  const title = mutation.isPending
    ? "Verifying your email..."
    : mutation.isSuccess
      ? "Email verified"
      : "Verification failed"

  const description = mutation.isSuccess
    ? "Your email is verified. You can log in now."
    : mutation.isError
      ? "The verification link is invalid or expired."
      : "Please wait while we verify your email."

  return (
    <AuthLayout>
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <LoadingButton
          asChild
          className="w-full"
          loading={mutation.isPending}
        >
          <RouterLink to="/login">Go to login</RouterLink>
        </LoadingButton>
      </div>
    </AuthLayout>
  )
}

export default VerifyEmail
