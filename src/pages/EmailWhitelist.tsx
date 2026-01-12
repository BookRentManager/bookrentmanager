import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserViewScope } from "@/hooks/useUserViewScope";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Trash2, Info } from "lucide-react";
import { format } from "date-fns";

const emailSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

type WhitelistedEmailWithProfile = {
  id: string;
  email: string;
  notes: string | null;
  added_by: string | null;
  created_at: string;
  addedByProfile?: {
    id: string;
    email: string | null;
    display_name: string | null;
  };
};


export default function EmailWhitelist() {
  const { user } = useAuth();
  const { isReadOnly } = useUserViewScope();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState<{ id: string; email: string } | null>(null);

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
      notes: "",
    },
  });

  // Fetch whitelisted emails
  const { data: whitelistedEmails, isLoading } = useQuery<WhitelistedEmailWithProfile[]>({
    queryKey: ["whitelisted-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelisted_emails")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately for added_by users
      if (data && data.length > 0) {
        const userIds = data.map(item => item.added_by).filter((id): id is string => id !== null);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email, display_name")
            .in("id", userIds);

          // Merge profiles data
          return data.map(item => ({
            ...item,
            addedByProfile: profiles?.find(p => p.id === item.added_by),
          }));
        }
      }

      return data || [];
    },
  });

  // Add email mutation
  const addEmailMutation = useMutation({
    mutationFn: async ({ email, notes }: EmailFormValues) => {
      const { error } = await supabase
        .from("whitelisted_emails")
        .insert([{
          email: email.toLowerCase().trim(),
          notes: notes?.trim() || null,
          added_by: user?.id,
        }]);

      if (error) {
        if (error.code === "23505") {
          throw new Error("This email is already whitelisted");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelisted-emails"] });
      toast.success("Email added to whitelist");
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add email");
    },
  });

  // Delete email mutation
  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whitelisted_emails")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelisted-emails"] });
      toast.success("Email removed from whitelist");
      setDeleteEmail(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to remove email: " + error.message);
    },
  });

  const onSubmit = (values: EmailFormValues) => {
    addEmailMutation.mutate(values);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Whitelist</h1>
          <p className="text-muted-foreground mt-2">
            Manage emails that receive Staff role on registration
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Email
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Whitelisted Email</DialogTitle>
              <DialogDescription>
                Add an email address that will receive the Staff role when they register.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="user@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Business partner, Supplier contact..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addEmailMutation.isPending}>
                    {addEmailMutation.isPending ? "Adding..." : "Add Email"}
                  </Button>
                </div>
              </form>
            </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Email Whitelist</AlertTitle>
        <AlertDescription>
          Emails added to this list will receive the "Staff" role upon registration.
          All @kingrent.com emails are automatically whitelisted and don't need to be added here.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Whitelisted Emails</CardTitle>
          <CardDescription>
            Users with these email addresses will receive Staff role when they register
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !whitelistedEmails || whitelistedEmails.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No whitelisted emails yet</p>
              <p className="text-sm text-muted-foreground">
                Add email addresses that should have Staff role access when they register.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whitelistedEmails.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.email}</TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {item.notes || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.addedByProfile?.display_name || item.addedByProfile?.email || "System"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteEmail({ id: item.id, email: item.email })}
                          title="Remove from whitelist"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteEmail} onOpenChange={() => setDeleteEmail(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Email from Whitelist?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteEmail?.email}</strong> from the whitelist?
              <br /><br />
              This won't affect their existing account, but they won't be able to register new accounts with Staff role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEmail && deleteEmailMutation.mutate(deleteEmail.id)}
              disabled={deleteEmailMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEmailMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
