const PROD_BASE = "https://gowma.vercel.app";

async function main() {
  // Sign in as Super Admin
  const loginRes = await fetch(`${PROD_BASE}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "superadmin@gomaa.in", password: "SuperAdmin@2026!" }),
  });
  const loginData = await loginRes.json();
  if (!loginData.ok || !loginData.token) {
    console.error("Super Admin login failed:", loginData);
    return;
  }
  const token = loginData.token;
  console.log("Logged in as Super Admin. Token length:", token.length);

  // 1. Fetch all settlements
  const setRes = await fetch(`${PROD_BASE}/api/superadmin/settlements`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const setData = await setRes.json();
  console.log("Settlements response status:", setRes.status);
  const settlements = setData.settlements || [];
  console.log("Total settlements count on production:", settlements.length);
  for (const s of settlements) {
    console.log({
      id: s.id,
      bookingId: s.bookingId,
      gosalaName: s.gosalaName,
      gosalaId: s.gosalaId,
      status: s.status,
      grossRupees: s.grossRupees,
      platformRupees: s.platformRupees,
      adminRupees: s.adminRupees,
      managerRupees: s.managerRupees,
      platformBp: s.platformBp,
      adminBp: s.adminBp,
      managerBp: s.managerBp,
      eligibleAt: s.eligibleAt,
      paidAt: s.paidAt,
    });
  }

  // Find GMA-25138 specifically
  const target = settlements.find(s => s.bookingId === 'GMA-25138' || (s.bookingId && s.bookingId.includes('25138')));
  console.log("\n--- TARGET SETTLEMENT GMA-25138 ---");
  console.log(target);

  // 2. Fetch split policy
  const splitRes = await fetch(`${PROD_BASE}/api/split-policy`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const splitData = await splitRes.json();
  console.log("\n--- SPLIT POLICY ON PRODUCTION ---");
  console.log(JSON.stringify(splitData, null, 2));

  // 3. Test approving GMA-25138 if found
  if (target) {
    console.log("\n--- TESTING APPROVAL FOR GMA-25138 ---");
    const appRes = await fetch(`${PROD_BASE}/api/superadmin/settlements/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ids: [target.id], note: "Testing approval of GMA-25138" })
    });
    console.log("Approval response HTTP status:", appRes.status);
    const appData = await appRes.json();
    console.log("Approval response body:", appData);
  }
}

main().catch(console.error);
