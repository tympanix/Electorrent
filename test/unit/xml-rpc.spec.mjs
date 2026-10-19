import http from "node:http"
import chai from "chai"

import { XmlRpcClient } from "../../node_modules/.cache/tsc/main/src/main/lib/xml-rpc.js"

const { expect } = chai

describe("XmlRpcClient", () => {
    let server
    let endpoint
    let requestBody = ""

    before(async () => {
        server = http.createServer((request, response) => {
            const chunks = []
            request.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
            request.on("end", () => {
                requestBody = Buffer.concat(chunks).toString("utf8")
                response.setHeader("Content-Type", "text/xml")

                if (requestBody.includes("<methodName>fault</methodName>")) {
                    response.end("<methodResponse><fault><value><struct><member><name>faultCode</name><value><int>42</int></value></member><member><name>faultString</name><value><string>failed</string></value></member></struct></value></fault></methodResponse>")
                    return
                }
                if (requestBody.includes("<methodName>malformed</methodName>")) {
                    response.end("<methodResponse><params>")
                    return
                }
                if (requestBody.includes("<methodName>doctype</methodName>")) {
                    response.end("<!DOCTYPE methodResponse><methodResponse><params><param><value><string>unsafe</string></value></param></params></methodResponse>")
                    return
                }
                if (requestBody.includes("<methodName>positive</methodName>")) {
                    response.end("<methodResponse><params><param><value><int>+12</int></value></param></params></methodResponse>")
                    return
                }

                response.end("<methodResponse><params><param><value><array><data><value><struct><member><name>date</name><value><dateTime.iso8601>19980717T14:08:55</dateTime.iso8601></value></member><member><name>bytes</name><value><base64>aGVsbG8=</base64></value></member></struct></value><value><i8>9007199254740993</i8></value></data></array></value></param></params></methodResponse>")
            })
        })

        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
        const address = server.address()
        if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port")
        endpoint = new URL(`http://127.0.0.1:${address.port}/RPC2`)
    })

    after(async () => {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    })

    it("serializes typed parameters and decodes nested typed values", async () => {
        const client = new XmlRpcClient(endpoint)
        const result = await client.call("demo<&", [2_147_483_648, "<value>", Buffer.from("data"), new Date("1998-07-17T14:08:55.000Z")])

        expect(requestBody).to.include("<methodName>demo&lt;&amp;</methodName>")
        expect(requestBody).to.include("<i8>2147483648</i8>")
        expect(requestBody).to.include("<string>&lt;value&gt;</string>")
        expect(requestBody).to.include("<base64>ZGF0YQ==</base64>")
        expect(requestBody).to.include("<dateTime.iso8601>19980717T14:08:55</dateTime.iso8601>")
        expect(result[0].date).to.deep.equal(new Date("1998-07-17T14:08:55.000Z"))
        expect(result[0].bytes).to.deep.equal(Buffer.from("hello"))
        expect(result[1]).to.equal(9_007_199_254_740_993n)
    })

    it("turns XML-RPC faults into errors with fault metadata", async () => {
        try {
            await new XmlRpcClient(endpoint).call("fault")
            expect.fail("Expected an XML-RPC fault")
        } catch (error) {
            expect(error.message).to.equal("failed")
            expect(error.faultCode).to.equal(42)
        }
    })

    it("accepts the optional XML-RPC integer plus sign", async () => {
        expect(await new XmlRpcClient(endpoint).call("positive")).to.equal(12)
    })

    it("rejects malformed XML and document type declarations", async () => {
        for (const [method, message] of [["malformed", "Invalid XML-RPC response"], ["doctype", "forbidden document type declaration"]]) {
            try {
                await new XmlRpcClient(endpoint).call(method)
                expect.fail(`Expected ${method} response to fail`)
            } catch (error) {
                expect(error.message).to.include(message)
            }
        }
    })
})
