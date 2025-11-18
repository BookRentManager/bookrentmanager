import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Processing password reset request for:", email);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate password reset token
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('APP_DOMAIN')}/auth`
      }
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      return new Response(
        JSON.stringify({ error: "Failed to generate reset link" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Reset link generated successfully");

    // Get app settings for branding
    const { data: settings } = await supabase
      .from("app_settings")
      .select("company_name, logo_url")
      .single();

    const companyName = settings?.company_name || "Car Rental";
    const logoUrl = settings?.logo_url || "";

    // Generate HTML email content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #1a1a1a; padding: 30px; text-align: center; }
    .logo { max-width: 150px; height: auto; }
    .content { padding: 40px 30px; }
    .button { display: inline-block; padding: 15px 30px; background-color: #0066cc; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .footer { background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #666666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" class="logo" style="max-width: 150px; height: auto;">` : `<h1 style="color: #ffffff; margin: 0;">${companyName}</h1>`}
    </div>
    <div class="content">
      <h2 style="color: #333333; margin-top: 0;">Reset Your Password</h2>
      <p style="color: #666666; line-height: 1.6;">
        We received a request to reset your password. Click the button below to create a new password:
      </p>
      <div style="text-align: center;">
        <a href="${resetData.properties.action_link}" class="button">Reset Password</a>
      </div>
      <p style="color: #666666; line-height: 1.6; margin-top: 30px;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
      <p style="color: #666666; line-height: 1.6;">
        This link will expire in 1 hour for security reasons.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
`;

    const subject = `Reset Your Password - ${companyName}`;

    // Prepare webhook payload
    const webhookUrl = Deno.env.get("ZAPIER_PASSWORD_RESET_WEBHOOK_URL");
    
    if (!webhookUrl) {
      console.error("ZAPIER_PASSWORD_RESET_WEBHOOK_URL not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const webhookPayload = {
      email: email,
      resetLink: resetData.properties.action_link,
      companyName: companyName,
      logoUrl: logoUrl,
      timestamp: new Date().toISOString(),
      htmlContent: htmlContent,
      subject: subject,
    };

    console.log("Sending to Zapier webhook:", webhookUrl);
    console.log("Webhook payload includes:", {
      email,
      hasResetLink: !!resetData.properties.action_link,
      hasHtmlContent: !!htmlContent,
      hasSubject: !!subject
    });

    // Send to Zapier
    const zapierResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!zapierResponse.ok) {
      console.error("Zapier webhook failed:", await zapierResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to send reset email" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Password reset email sent successfully via Zapier");

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Password reset email sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in trigger-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
