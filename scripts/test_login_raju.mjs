async function testLogin(email, password) {
  console.log(`\nAttempting login for '${email}' with password '${password}'...`)
  try {
    const res = await fetch("http://localhost:8443/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrPhone: email, password }),
    })
    const body = await res.json()
    console.log(`Status: ${res.status}`)
    console.log(`Response body:`, JSON.stringify(body, null, 2))
    if (res.status === 200 && body.ok && body.token) {
      console.log(`✓ SUCCESS! Token issued. User role: ${body.user?.role}, Name: ${body.user?.name}, Gosalas:`, body.user?.assignedGosalaNames)
      return true
    } else {
      console.error(`✗ FAILED: Status ${res.status}, Error: ${body.error}`)
      return false
    }
  } catch (err) {
    console.error(`✗ NETWORK / SERVER ERROR:`, err.message)
    return false
  }
}

async function main() {
  console.log("==========================================")
  console.log("   TESTING LOGIN API FOR RAJU & OTHERS    ")
  console.log("==========================================")

  // 1. Test Raju with exact case
  const ok1 = await testLogin("Raju@gmail.com", "raju123")

  // 2. Test Raju with lowercase email
  const ok2 = await testLogin("raju@gmail.com", "raju123")

  // 3. Test Raju with first-letter capitalized password (mobile auto-caps)
  const ok3 = await testLogin("raju@gmail.com", "Raju123")

  // 4. Test Super Admin
  const ok4 = await testLogin("superadmin@gomaa.in", "SuperAdmin@2026!")

  // 5. Test Manager 1
  const ok5 = await testLogin("manager1@gomaa.in", "GomaaAdmin@2026!")
  
  if (ok1 && ok2 && ok3 && ok4 && ok5) {
    console.log("\n==========================================")
    console.log("  ALL CRITICAL LOGIN TESTS PASSED!       ")
    console.log("==========================================")
  } else {
    console.error("\nSome tests failed!")
    process.exit(1)
  }
}

main()
