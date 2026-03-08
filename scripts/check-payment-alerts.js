#!/usr/bin/env node
/**
 * Cron job: Check payment alerts and send to Telegram admin
 * 
 * Usage:
 *   node scripts/check-payment-alerts.js
 * 
 * Recommended crontab schedule (every 2 hours):
 *   0 star-slash-2 star star star (replace "star" with *)
 */

const path = require("path");

// Load environment before importing services
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { getPaymentAlerts } = require("../src/services/payment-analytics");
const { sendPaymentAlertsToAdmin } = require("../src/services/telegram");

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting payment alerts check...`);

  try {
    // Get current alerts
    const alerts = await getPaymentAlerts();
    
    if (!alerts || alerts.length === 0) {
      console.log("✓ No alerts found. All clear!");
      process.exit(0);
    }

    // Filter for critical and warning alerts only
    const notifiableAlerts = alerts.filter(
      (a) => a.severity === "critical" || a.severity === "warning"
    );

    if (notifiableAlerts.length === 0) {
      console.log(`✓ Found ${alerts.length} info alerts (not notifying)`);
      process.exit(0);
    }

    // Send to Telegram
    console.log(`⚠️  Found ${notifiableAlerts.length} critical/warning alerts, sending to Telegram...`);
    await sendPaymentAlertsToAdmin(notifiableAlerts);

    const duration = Date.now() - startTime;
    console.log(`✓ Alerts sent successfully (${duration}ms)`);
    
    // Log summary
    notifiableAlerts.forEach((alert) => {
      console.log(`  - [${alert.severity.toUpperCase()}] ${alert.message}`);
    });

    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ Error checking payment alerts (${duration}ms):`, error);
    
    // Don't throw - we don't want cron to spam with errors
    // Just log and exit with error code
    process.exit(1);
  }
}

main();
