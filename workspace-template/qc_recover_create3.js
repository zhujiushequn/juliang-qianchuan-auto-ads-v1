// Retired safety stub.
//
// This file used to be an emergency one-off recovery script. It hardcoded a
// Qianchuan account, a historical ad group, fixed targeting, and auto-publish
// behavior. Keeping it executable would be unsafe for customer reuse.

throw new Error(
  [
    'qc_recover_create3.js has been retired for safety.',
    'Use cdp_qc_create_today10.js or cdp_qc_batch_loop.js with explicit --aavid, --account-name, --target-group, --bid, --gender, and --age arguments.',
    'Do not restore hardcoded account IDs or historical ad group names in reusable workflows.',
  ].join('\n'),
);
