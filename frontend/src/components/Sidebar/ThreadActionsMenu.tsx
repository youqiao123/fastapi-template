import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Archive, MoreHorizontalIcon, Pencil, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { useSidebar } from "@/components/ui/sidebar"
import useCustomToast from "@/hooks/useCustomToast"
import {
  archiveThread,
  deleteThread,
  THREADS_QUERY_KEY,
  updateThread,
} from "@/lib/threads"
import { handleError } from "@/utils"

const formSchema = z.object({
  title: z
    .string()
    .min(1, { message: "Title is required" })
    .max(255, { message: "Title is too long" }),
})

type FormData = z.infer<typeof formSchema>

interface ThreadActionsMenuProps {
  threadId: string
  title: string
  threadTitle?: string | null
  isParentActive: boolean
}

export function ThreadActionsMenu({
  threadId,
  title,
  threadTitle,
  isParentActive,
}: ThreadActionsMenuProps) {
  const { isMobile } = useSidebar()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouterState()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const currentPath = router.location.pathname

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: threadTitle ?? "",
    },
  })

  useEffect(() => {
    if (renameOpen) {
      form.reset({ title: threadTitle ?? "" })
    }
  }, [form, renameOpen, threadTitle])

  const renameMutation = useMutation({
    mutationFn: (data: FormData) => updateThread(threadId, data),
    onSuccess: () => {
      showSuccessToast("Thread renamed")
      setRenameOpen(false)
      setMenuOpen(false)
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
    },
    onError: handleError.bind(showErrorToast),
  })

  const archiveMutation = useMutation({
    mutationFn: () => archiveThread(threadId),
    onSuccess: () => {
      showSuccessToast("Thread archived")
      setMenuOpen(false)
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteThread(threadId),
    onSuccess: () => {
      showSuccessToast("Thread deleted")
      setDeleteOpen(false)
      setMenuOpen(false)
      if (currentPath === `/workspace/${threadId}`) {
        navigate({ to: "/workspace" })
      }
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <>
      <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Thread actions for ${title}`}
            title="Thread actions"
            tabIndex={isParentActive ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation()
            }}
            className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md p-0 opacity-0 pointer-events-none outline-hidden transition-opacity focus-visible:ring-2 group-hover/menu-sub-item:opacity-100 group-hover/menu-sub-item:pointer-events-auto group-focus-within/menu-sub-item:opacity-100 group-focus-within/menu-sub-item:pointer-events-auto data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto"
          >
            <MoreHorizontalIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isMobile ? "top" : "right"}
          align="end"
          className="min-w-32"
        >
          <DropdownMenuItem
            onClick={() => {
              setRenameOpen(true)
              setMenuOpen(false)
            }}
          >
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              archiveMutation.mutate()
              setMenuOpen(false)
            }}
            disabled={archiveMutation.isPending}
          >
            <Archive />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setDeleteOpen(true)
              setMenuOpen(false)
            }}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => {
                renameMutation.mutate(data)
              })}
            >
              <DialogHeader>
                <DialogTitle>Rename thread</DialogTitle>
                <DialogDescription>
                  Update the thread title.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Title <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Thread title" type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={renameMutation.isPending}>
                    Cancel
                  </Button>
                </DialogClose>
                <LoadingButton type="submit" loading={renameMutation.isPending}>
                  Save
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete thread</DialogTitle>
            <DialogDescription>
              This thread will be permanently deleted. You will not be able to
              undo this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={deleteMutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <LoadingButton
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
