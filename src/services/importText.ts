import { invoke } from "@tauri-apps/api/core";

const supportedExtensions = ["txt", "md", "doc", "docx"];

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function toBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < view.length; index += chunkSize) binary += String.fromCharCode(...view.subarray(index, index + chunkSize));
  return btoa(binary);
}

export async function importTextFile(file: File) {
  const extension = extensionOf(file.name);
  if (!supportedExtensions.includes(extension)) throw new Error("请选择 .txt、.md、.doc 或 .docx 文件。");
  if (file.size > 20 * 1024 * 1024) throw new Error("文件超过 20 MB，请拆分后再导入。");
  if (extension === "txt" || extension === "md") {
    const text = (await file.text()).replace(/\r\n/g, "\n").trim();
    if (!text) throw new Error("文件中没有可导入的文本。");
    return text;
  }
  return invoke<string>("extract_word_text", { filename: file.name, contentsBase64: toBase64(await file.arrayBuffer()) });
}
