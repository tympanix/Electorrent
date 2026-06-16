import SpecReporter from "@wdio/spec-reporter"
import type { Capabilities, Reporters } from "@wdio/types"
import type { TestClient } from "../clients"

interface ElectorrentCapabilities extends WebdriverIO.Capabilities {
  "electorrent:client"?: TestClient
}

function electorrentClientLabel(capability: Capabilities.ResolvedTestrunnerCapabilities) {
  const caps = "alwaysMatch" in capability ? capability.alwaysMatch : capability
  const client = (caps as ElectorrentCapabilities)["electorrent:client"]

  return client?.key
}

function reporterClientLabel(options: Partial<Reporters.Options>) {
  return typeof options.clientLabel === "string" ? options.clientLabel : undefined
}

export default class ElectorrentSpecReporter extends SpecReporter {
  constructor(options: Partial<Reporters.Options>) {
    super(options as ConstructorParameters<typeof SpecReporter>[0])
  }

  getEnviromentCombo(
    capability: Capabilities.ResolvedTestrunnerCapabilities,
    verbose = true,
    isMultiremote = false,
  ) {
    const clientLabel = electorrentClientLabel(capability) ?? reporterClientLabel(this.options)

    if (clientLabel) {
      return clientLabel
    }

    return super.getEnviromentCombo(capability, verbose, isMultiremote)
  }
}
