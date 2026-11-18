/**
 * Teste de ponta a ponta da API (sem navegador), usando gateway SIMULADO da Profanus Pay.
 * Sem banco e sem webhook: só PROFANUS_API_KEY. Roda:  npm test
 */
import { spawn } from "node:child_process";
import { startMockGateway } from "./mock-gateway.js";

const GW = 4101, APP = 4100;
const base = `http://localhost:${APP}`, gw = `http://localhost:${GW}`;
const mock = await startMockGateway(GW);

const proc = spawn("node", ["server/server.js"], {
  env: { ...process.env, PORT: APP, PUBLIC_URL: base, PROFANUS_API_KEY: "TEST_KEY", PROFANUS_API_BASE: gw, RESEND_API_KEY: "", MAIL_FROM: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
proc.stderr.on("data", (d) => process.env.DEBUG && process.stderr.write(d));
await new Promise((r) => { proc.stdout.on("data", (d) => String(d).includes("Loja no ar") && r()); });

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗ FALHOU"} ${name}`); };
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const gwState = () => fetch(`${gw}/__state`).then((r) => r.json());

const customer = { name: "Maria da Silva", email: "maria@example.com", cpf: "529.982.247-25", phone: "(11) 91234-5678" };
const address = { cep: "01310-100", street: "Av. Paulista", number: "1000", complement: "Apto 5", district: "Bela Vista", city: "São Paulo", state: "SP" };
const items = [{ size: "180", qty: 2 }];
const state = { items, customer, address, shippingId: "padrao" };

try {
  // Estático + segurança
  const home = await fetch(base + "/");
  ok(home.status === 200 && home.headers.get("content-security-policy"), "landing responde com CSP");
  ok((await fetch(base + "/carrinho")).status === 200, "/carrinho (URL sem .html)");
  ok((await fetch(base + "/checkout/pix")).status === 200, "/checkout/pix");
  ok((await fetch(base + "/server/server.js")).status === 404, "código do servidor NÃO é público");
  ok((await fetch(base + "/..%2f.env")).status === 404, "path traversal bloqueado");

  // Validação
  let r = await call("POST", "/api/orders", { items: [{ size: "180", qty: 1 }], customer: { ...customer, cpf: "111.111.111-11" } });
  ok(r.status === 422 && r.data.fields.cpf, "CPF inválido é recusado no servidor");
  r = await call("POST", "/api/orders", { items: [{ size: "210", qty: 1 }], customer });
  ok(r.status === 400, "tamanho sem preço (2,10 m) não pode ser comprado");
  r = await call("POST", "/api/orders", { items: [{ size: "180", qty: 999 }], customer });
  ok(r.status === 400, "quantidade absurda é recusada");
  r = await call("POST", "/api/orders", { items: [{ size: "180", qty: 1, price: 0.01 }], customer });
  ok(r.status === 200, "campo 'price' enviado pelo cliente é ignorado");

  // Fluxo feliz
  r = await call("POST", "/api/orders", { items, customer });
  const id = r.data.orderId;
  ok(r.status === 200 && /^NAT-[0-9A-F]{6}$/.test(r.data.number), `pedido criado (${r.data.number})`);
  r = await call("POST", "/api/orders", { id, items, customer });
  ok(r.data.orderId === id, "reenviar a etapa 1 mantém o mesmo id do pedido");
  r = await call("POST", `/api/orders/${id}/address`, { address: { ...address, cep: "123" }, shippingId: "padrao" });
  ok(r.status === 422 && r.data.fields.cep, "CEP inválido recusado");
  r = await call("POST", `/api/orders/${id}/address`, { address, shippingId: "expresso" });
  ok(r.status === 400, "frete desativado não pode ser escolhido");
  r = await call("POST", `/api/orders/${id}/address`, { address, shippingId: "padrao" });
  ok(r.status === 200, "endereço + frete validados (POST /address)");
  r = await call("POST", `/api/orders/${id}/pix`, { ...state, address: undefined });
  ok(r.status === 422, "não gera Pix sem endereço");
  r = await call("GET", "/api/orders/nao-e-uuid/status");
  ok(r.status === 404, "id inválido é recusado");

  r = await call("GET", `/api/orders/${id}/status`);
  ok(r.data.status === "checkout", "antes de gerar o Pix o status é 'checkout'");

  r = await call("POST", `/api/orders/${id}/pix`, state);
  ok(r.status === 200 && r.data.code.startsWith("00020126") && r.data.amountCents === 1990, "Pix gerado com valor de R$ 19,90 (config, não do cliente)");
  ok(!r.data.qrBase64.startsWith("data:"), "QR Code devolvido ao front sem o prefixo data: (o front adiciona)");
  const pay1 = (await gwState()).payments[0];
  ok(pay1._request.amount === 19.9 && pay1._request.expiration > 0, "gateway recebeu valor (em reais) e expiração em segundos");
  ok(pay1._request.external_id === `${id}_1` && pay1._request.webhook_url === undefined, "external_id = <pedido>_<tentativa>; sem webhook");
  ok(pay1._request.description.startsWith("NAT-") && pay1._request.description.includes("Maria da Silva") && pay1._request.description.includes("11912345678") && pay1._request.description.length <= 140, "descrição do Pix traz pedido, nome e telefone (≤ 140)");
  const r2 = await call("POST", `/api/orders/${id}/pix`, state);
  ok(r2.data.code === r.data.code && (await gwState()).payments.length === 1, "clicar duas vezes NÃO duplica a cobrança");

  r = await call("GET", `/api/orders/${id}/status`);
  ok(r.data.status === "awaiting_payment", "status = aguardando pagamento (sem simular aprovação)");
  r = await call("GET", `/api/orders/${id}`);
  ok(r.data.status === "awaiting_payment" && r.data.pix.code === r2.data.code && !JSON.stringify(r.data).includes("529"), "tela do Pix lê da Profanus e não expõe CPF");

  // Aprovação
  await fetch(`${gw}/__approve?id=${pay1.id}&amount=19.9`);
  r = await call("GET", `/api/orders/${id}/status`);
  ok(r.data.status === "paid" && r.data.amountCents === 1990, "após aprovação na Profanus o pedido vira PAGO");
  r = await call("POST", `/api/orders/${id}/pix`, state);
  ok(r.status === 409, "pedido pago não gera novo Pix");

  // Expirado → novo Pix (tentativa 2)
  r = await call("POST", "/api/orders", { items: [{ size: "180", qty: 1 }], customer });
  const id2 = r.data.orderId;
  const state2 = { ...state, items: [{ size: "180", qty: 1 }] };
  await call("POST", `/api/orders/${id2}/pix`, state2);
  const pay2 = (await gwState()).payments[1];
  await fetch(`${gw}/__approve?id=${pay2.id}&status=expired`);
  r = await call("GET", `/api/orders/${id2}/status`);
  ok(r.data.status === "expired", "Pix expirado na Profanus aparece como 'expired'");
  r = await call("POST", `/api/orders/${id2}/pix`, state2);
  const st = await gwState();
  ok(r.status === 200 && st.payments.length === 3 && st.payments[2].external_id === `${id2}_2`, "após expirar, gera nova cobrança (_2)");
  r = await call("GET", `/api/orders/${id2}/status`);
  ok(r.data.status === "awaiting_payment", "status acompanha a tentativa mais recente");

  // Chave inválida na Profanus não vaza detalhes
  // Contato + health
  r = await call("POST", "/api/contact", { name: "Ana", email: "ana@example.com", message: "Olá, tenho uma dúvida" });
  ok(r.status === 200, "formulário de contato responde ok");
  r = await call("GET", "/api/health");
  ok(r.data.pix === true && !JSON.stringify(r.data).includes("TEST_KEY"), "health ok (sem vazar a chave)");
  r = await call("POST", "/api/webhooks/profanus", {});
  ok(r.status === 404, "não existe rota de webhook (não é necessária)");
} finally {
  proc.kill(); mock.close();
}
console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
