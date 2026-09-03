import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt =
  "WebMCP workspace — human and agent on the same live apps.";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [interRegular, interMedium, tree] = await Promise.all([
    readFile(new URL("./fonts/Inter-latin-400.ttf", import.meta.url)),
    readFile(new URL("./fonts/Inter-latin-500.ttf", import.meta.url)),
    readFile(new URL("../public/root-tree.png", import.meta.url)),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#171717",
            fontSize: 48,
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          Root
        </div>
        <img
          src={`data:image/png;base64,${tree.toString("base64")}`}
          width={672}
          height={408}
          style={{ marginTop: 16 }}
        />
        <div
          style={{
            display: "flex",
            marginTop: 12,
            maxWidth: 800,
            color: "#525252",
            fontSize: 24,
            fontWeight: 400,
            lineHeight: 1.35,
            textAlign: "center",
          }}
        >
          WebMCP workspace — human and agent on the same live apps.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: interRegular,
          weight: 400,
          style: "normal",
        },
        {
          name: "Inter",
          data: interMedium,
          weight: 500,
          style: "normal",
        },
      ],
    },
  );
}
