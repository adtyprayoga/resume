import { describe, expect, it } from 'vitest'
import { classifyImageSource } from './imageSource'

const BASE = 'https://resume.example/app/'

describe('classifyImageSource', () => {
  it.each([
    ['', 'none'],
    ['data:image/png;base64,AAA', 'embedded'],
    ['data:image/jpeg;base64,AAA', 'embedded'],
    ['data:image/svg+xml;base64,AAA', 'blocked'],
    ['data:text/html,x', 'blocked'],
    ['/images/me.png', 'same-origin'],
    ['me.jpg', 'same-origin'],
    ['https://resume.example/me.jpg', 'same-origin'],
    ['https://photos.example/me.jpg', 'remote-https'],
    ['https://resume.example.evil.test/me.jpg', 'remote-https'],
    ['https://resume.example:8443/me.jpg', 'remote-https'],
    ['http://resume.example/me.jpg', 'remote-http'],
    ['http://photos.example/me.jpg', 'remote-http'],
    ['//photos.example/me.jpg', 'remote-https'],
    ['javascript:alert(1)', 'blocked'],
    ['blob:https://resume.example/1', 'blocked'],
  ])('%s → %s', (value, kind) => {
    expect(classifyImageSource(value, BASE).kind).toBe(kind)
  })

  it('reports the host of a remote photo', () => {
    expect(classifyImageSource('https://photos.example/me.jpg', BASE)).toEqual({
      kind: 'remote-https', url: 'https://photos.example/me.jpg', host: 'photos.example',
    })
  })
})
