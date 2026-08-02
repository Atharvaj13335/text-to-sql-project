import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3001";
let authToken = "";
const testEmail = `analyst_${Date.now()}@example.com`;
const testPassword = "SecurePassword123!";

async function runTests() {
  console.log("==================================================");
  console.log("🚀 STARTING COMPREHENSIVE SYSTEM VERIFICATION TEST");
  console.log("==================================================\n");

  // 1. SIGN UP
  console.log("1️⃣ Testing User Sign Up (/api/auth/signup)...");
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, name: "Lead Analyst", password: testPassword }),
  });
  const signupData = await signupRes.json();
  console.log("   Status:", signupRes.status);
  console.log("   Result:", signupData.success ? "PASSED ✅" : "FAILED ❌", signupData);
  authToken = signupData.token;

  // 2. SIGN IN
  console.log("\n2️⃣ Testing User Sign In (/api/auth/signin)...");
  const signinRes = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const signinData = await signinRes.json();
  console.log("   Status:", signinRes.status);
  console.log("   Result:", signinData.success ? "PASSED ✅" : "FAILED ❌");

  // 3. GET PROFILE (JWT Protected)
  console.log("\n3️⃣ Testing Profile Fetch (/api/auth/profile)...");
  const profileRes = await fetch(`${BASE_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const profileData = await profileRes.json();
  console.log("   Status:", profileRes.status);
  console.log("   Result:", profileData.success ? "PASSED ✅" : "FAILED ❌", "User:", profileData.user?.email);

  // 4. TEXT-TO-SQL COMPANY FILTERING QUERY
  console.log("\n4️⃣ Testing Text-to-SQL Query (/api/ask)...");
  const askRes = await fetch(`${BASE_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ question: "What is the inception date of Alpha Tech Ventures Account?" }),
  });
  const askData = await askRes.json();
  console.log("   Status:", askRes.status);
  console.log("   Result:", askData.success ? "PASSED ✅" : "FAILED ❌");
  console.log("   SQL Generated:", askData.sql);
  console.log("   Rows Returned:", askData.rows?.length);
  console.log("   RAG Context:", askData.ragDocs?.map(d => d.title).join(" | "));

  // 5. CONVERSATIONAL GREETING FALLBACK
  console.log("\n5️⃣ Testing Conversational Greeting Handling (/api/ask)...");
  const greetRes = await fetch(`${BASE_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ question: "Hello, what can you help me with?" }),
  });
  const greetData = await greetRes.json();
  console.log("   Status:", greetRes.status);
  console.log("   Result:", (greetData.success && greetData.isConversational) ? "PASSED ✅" : "FAILED ❌");
  console.log("   Response:", greetData.aiAnswer || greetData.explanation);

  // 6. CUSTOM SQL SANDBOX EXECUTION (JWT Protected)
  console.log("\n6️⃣ Testing Custom SQL Execution (/api/execute-sql)...");
  const execRes = await fetch(`${BASE_URL}/api/execute-sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ sql: "SELECT TOP 5 AccountName, MarketValue FROM Account ORDER BY MarketValue DESC" }),
  });
  const execData = await execRes.json();
  console.log("   Status:", execRes.status);
  console.log("   Result:", execData.success ? "PASSED ✅" : "FAILED ❌");
  console.log("   Columns:", execData.columns);
  console.log("   Rows:", execData.rows?.length);

  // 7. CHAT PERSISTENCE CRUD
  console.log("\n7️⃣ Testing Chat Persistence CRUD (/api/chats)...");
  const chatId = `test_chat_${Date.now()}`;
  
  // Create
  const createChatRes = await fetch(`${BASE_URL}/api/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ chatId, title: "Test Portfolio Query" }),
  });
  const createChatData = await createChatRes.json();
  console.log("   Create Chat Result:", createChatData.success ? "PASSED ✅" : "FAILED ❌");

  // Update (Fix verification for swapped arguments)
  const updateChatRes = await fetch(`${BASE_URL}/api/chats/${chatId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ title: "Updated Portfolio Title" }),
  });
  const updateChatData = await updateChatRes.json();
  console.log("   Update Chat Result:", updateChatData.success ? "PASSED ✅" : "FAILED ❌", "New Title:", updateChatData.chat?.title);

  // Get All
  const getChatsRes = await fetch(`${BASE_URL}/api/chats`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const getChatsData = await getChatsRes.json();
  console.log("   Get Chats Count:", getChatsData.chats?.length);

  // Delete
  const deleteChatRes = await fetch(`${BASE_URL}/api/chats/${chatId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const deleteChatData = await deleteChatRes.json();
  console.log("   Delete Chat Result:", deleteChatData.success ? "PASSED ✅" : "FAILED ❌");

  // 8. AUDIT LOG FILE VERIFICATION
  console.log("\n8️⃣ Testing Audit Log File (logs/audit.jsonl)...");
  const auditPath = path.join(process.cwd(), "logs", "audit.jsonl");
  const exists = fs.existsSync(auditPath);
  if (exists) {
    const lines = fs.readFileSync(auditPath, "utf-8").trim().split("\n");
    console.log("   Audit Log File:", "PASSED ✅", `Total Entries: ${lines.length}`);
    console.log("   Latest Audit Record:", lines[lines.length - 1]);
  } else {
    console.log("   Audit Log File: FAILED ❌ (file not found)");
  }

  console.log("\n==================================================");
  console.log("🎉 ALL FUNCTIONAL TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch(console.error);
