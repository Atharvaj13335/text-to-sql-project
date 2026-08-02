# Secrets Management & Key Vault Integration Guide

In a production environment, sensitive secrets (e.g. `OPENROUTER_API_KEY`, `JWT_SECRET`, `MONGO_URI`, and `DB_PASSWORD`) must **never** be stored in `.env` files on local disk or committed to version control.

---

## 1. Azure Key Vault Architecture

When deploying to production (e.g., Azure App Service, Azure Container Apps, or Kubernetes):

```
+------------------------+      Managed Identity      +------------------------+
| Express Node.js Server | -------------------------> |    Azure Key Vault     |
| (App Service / K8s)    |   (No static credentials)  | (Encrypts at rest)     |
+------------------------+                            +------------------------+
```

### Key Vault Environment Mapping
- `OPENROUTER-API-KEY` → Secret name in Key Vault
- `JWT-SECRET` → Secret name in Key Vault
- `MONGO-URI` → Secret name in Key Vault
- `DB-PASSWORD` → Secret name in Key Vault

---

## 2. Programmatic Secret Retrieval (Node.js SDK)

Install official Azure Identity & Key Vault packages:
```bash
npm install @azure/identity @azure/keyvault-secrets
```

### Integration Snippet (`backend/vault.js`):
```javascript
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const vaultName = process.env.KEY_VAULT_NAME;
const vaultUrl = `https://${vaultName}.vault.azure.net`;

const credential = new DefaultAzureCredential();
const client = new SecretClient(vaultUrl, credential);

export async function getSecret(secretName) {
  if (process.env.NODE_ENV !== "production") {
    return process.env[secretName];
  }
  const secret = await client.getSecret(secretName);
  return secret.value;
}
```

---

## 3. Best Practices & Key Rotation
1. **Managed Identities**: Use Azure System-Assigned Managed Identity so no API keys or passwords exist in app code.
2. **Access Policies**: Grant `Get` / `List` secret permissions strictly to the application's principal ID.
3. **Automated Key Rotation**: Rotate `JWT_SECRET` periodically without downtime by using key versioning.
