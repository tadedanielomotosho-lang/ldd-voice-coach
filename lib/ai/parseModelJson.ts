function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return (fenced?.[1] ?? trimmed).trim()
}

function closeJson(input: string): string {
  let out = ''
  const stack: string[] = []
  let inString = false
  let escape = false

  for (const ch of input) {
    out += ch
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') stack.push(ch)
    else if ((ch === '}' || ch === ']') && stack.length > 0) stack.pop()
  }

  if (inString) out += '"'
  out = out.replace(/,\s*$/, '')
  out = out.replace(/:\s*$/, ': null')

  while (stack.length > 0) {
    const open = stack.pop()
    out += open === '{' ? '}' : ']'
  }

  return out
}

function lastCommaOutsideString(input: string): number {
  let inString = false
  let escape = false
  let last = -1

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === ',') last = i
  }

  return last
}

/** Parse model JSON, closing a reply that was cut off mid-object. */
export function parseModelJson(raw: string): unknown {
  const text = stripCodeFence(raw)
  if (!text) throw new Error('The analysis response was not valid JSON.')

  try {
    return JSON.parse(text)
  } catch {
    // Salvage below.
  }

  let slice = text
  for (let attempt = 0; attempt < 16; attempt++) {
    try {
      return JSON.parse(closeJson(slice))
    } catch {
      const comma = lastCommaOutsideString(slice)
      if (comma <= 0) break
      slice = slice.slice(0, comma)
    }
  }

  throw new Error('The analysis response was not valid JSON.')
}
