/** Função serverless da Vercel: recebe tudo em /api/* e delega para server/app.js. */
import { handleApi } from "../server/app.js";

export default function handler(req, res) {
  return handleApi(req, res);
}
