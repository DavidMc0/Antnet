# Update on #10: a file the CLI downloads whole has chunks the browser SDK reports missing

A fresh, reproducible case for #10, from 17 November 2026: a public file that `ant file download` fetches whole, while the browser SDK can't fetch two of its chunks, even after its retries.

## The file

- Public file `289d33813926d03993357676ea3a34ddca35540be40090498120985f585d5a51`. It's a 4K MP4: 607,951,519 bytes, 150 chunks (149 + data map).
- Uploaded on 17 November 2026 with `ant` CLI 0.3.13 (543 s; SHA-256 `99da55c0…0564`).

## What happens

| | Result |
| --- | --- |
| `ant file download 289d3381…` (CLI 0.3.13, same machine, the same evening) | Whole file in 23 s; SHA-256 matches. |
| Browser SDK, one 1-byte `reader.read()` in the middle of each chunk, 8 at a time | 144 of 149 chunks arrive. |
| Retrying the 5 that didn't, one file at a time, waiting up to 180 s | 2 arrive. 2 fail, after 128 s, with `OPEN_FILE_FAILED`. 1 never answers. |

The two failures each say:

```
Could not read the public file range: not found: Missing chunk <address> required for data reconstruction
```

for these chunks:

- `2184f7b046d88b5021e2b442c3f08ebf275156662e217715fe275ec989d09621` (plaintext around byte 46,922,432)
- `219bce564ecefbecb92c79ffed6c400ebef4543b832b55fec1b60e29821c3a24` (plaintext around byte 287,654,913)

The read around byte 410,061,259 never answered within 180 s.

In a `<video>` streamed through the SDK's media bridge from a `PublicFileReader`, playback stops for good at the first missing chunk: 38 s into this video.

## For comparison

The same check on four other public files found every chunk in the end:

| File | Chunks | Uploaded |
| --- | --- | --- |
| `7cc0b916…1359` | 155 | the same day |
| `32e07381…d28a` | 164 | most of its chunks were probably already on the network |
| `b1d79785…f13c` | 63 | 12 November |
| `76bb918c…de51` | 33 | 17 November |

Several of those chunks took 10–90 s in the browser, and some needed a second try. Only `289d3381…` has chunks that fail outright.

## Environment

- `@withautonomi/ant-browser-sdk` 0.1.5, default `AutonomiClient.connect()` with the bundled seeds
- Chromium (Playwright 1.65), headless, Windows 11, home broadband
- `ant` CLI 0.3.13 on the same machine, for comparison

## To reproduce

The script opens the file with `client.openFile()` and reads one byte from the middle of each chunk. Self-encryption splits a file into equal chunks, so chunk `i` covers about `[i * size / n, (i + 1) * size / n)`.

```js
const client = await AutonomiClient.connect();
const reader = await client.openFile("289d33813926d03993357676ea3a34ddca35540be40090498120985f585d5a51");
const n = 149;
for (const i of [11, 70]) {
  const at = Math.floor(((i + 0.5) * reader.size) / n);
  await reader.read(at, 1); // rejects after about 128 s: "Missing chunk … required for data reconstruction"
}
```

Our scan script (`tools/record-scan.mjs`, about 80 lines) is available on request.

## The question

The CLI reaches these chunks, so they're stored. Is this the closest-node lookup over WebRTC Direct missing holders that the CLI's QUIC path finds? For example: holders with no WebRTC address, or a close group that differs between the two transports. Is there anything we can log on our side that would help?
