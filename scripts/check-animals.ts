async function run() {
  try {
    const aRes = await fetch("http://localhost:8443/api/animals")
    const aData = await aRes.json()
    console.log("=== API ANIMALS ===")
    console.log("Count:", (aData.animals || []).length)
    ;(aData.animals || []).forEach((a: any) =>
      console.log("Name:", a.name, "| Gosala:", JSON.stringify(a.gosala), "| Status:", a.status)
    )

    const gRes = await fetch("http://localhost:8443/api/gosalas")
    const gData = await gRes.json()
    console.log("\n=== API GOSALAS ===")
    ;(gData.gosalas || []).forEach((g: any) =>
      console.log("ID:", g.id, "| Name:", JSON.stringify(g.name))
    )
  } catch (err: any) {
    console.error("Error fetching data:", err.message)
  }
}
run()
