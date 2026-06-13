param(
    [string]$ProjectRef = "cmfnmhqyeipgtjktbouk",
    [string]$AppUrl = "https://app.budget-buddy.io"
)

$ErrorActionPreference = "Stop"

function Get-SupabaseCommand {
    $supabase = Get-Command supabase -ErrorAction SilentlyContinue
    if ($supabase) {
        return @("supabase")
    }

    $npx = Get-Command npx -ErrorAction SilentlyContinue
    if ($npx) {
        return @("npx", "supabase")
    }

    throw "Supabase CLI was not found. Install it first, then rerun this script."
}

function Invoke-Supabase {
    param(
        [string[]]$SupabaseCommand,
        [string[]]$Arguments
    )

    $exe = $SupabaseCommand[0]
    $baseArgs = @()
    if ($SupabaseCommand.Length -gt 1) {
        $baseArgs = $SupabaseCommand[1..($SupabaseCommand.Length - 1)]
    }

    & $exe @baseArgs @Arguments
}

$SupabaseCommand = Get-SupabaseCommand
$SupabaseDisplay = $SupabaseCommand -join " "

Write-Host "Using Supabase project: $ProjectRef"
Write-Host "Using app URL: $AppUrl"
Write-Host ""
Write-Host "If you are not logged in, run: $SupabaseDisplay login"
Write-Host ""

$StripeSecretKey = Read-Host "Stripe secret key (sk_live_...)"
$StripeWebhookSecret = Read-Host "Stripe webhook signing secret (whsec_...)"

if (-not $StripeSecretKey.StartsWith("sk_")) {
    throw "Stripe secret key should start with sk_."
}

if (-not $StripeWebhookSecret.StartsWith("whsec_")) {
    throw "Stripe webhook secret should start with whsec_."
}

Invoke-Supabase $SupabaseCommand @("link", "--project-ref", $ProjectRef)
Invoke-Supabase $SupabaseCommand @("db", "push", "--project-ref", $ProjectRef)
Invoke-Supabase $SupabaseCommand @(
    "secrets",
    "set",
    "STRIPE_SECRET_KEY=$StripeSecretKey",
    "STRIPE_WEBHOOK_SECRET=$StripeWebhookSecret",
    "STRIPE_PREMIUM_PRICE_ID=price_1TgrnvJYNoBMRccPPRxiOOid",
    "APP_URL=$AppUrl",
    "--project-ref",
    $ProjectRef
)
Invoke-Supabase $SupabaseCommand @("functions", "deploy", "billing-create-checkout", "--project-ref", $ProjectRef)
Invoke-Supabase $SupabaseCommand @("functions", "deploy", "billing-create-portal", "--project-ref", $ProjectRef)
Invoke-Supabase $SupabaseCommand @("functions", "deploy", "billing-status", "--project-ref", $ProjectRef)
Invoke-Supabase $SupabaseCommand @("functions", "deploy", "stripe-webhook", "--project-ref", $ProjectRef)

Write-Host ""
Write-Host "Done. Add this webhook endpoint in Stripe:"
Write-Host "https://$ProjectRef.supabase.co/functions/v1/stripe-webhook"
