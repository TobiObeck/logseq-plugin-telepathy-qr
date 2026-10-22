import { describe, expect, it } from 'vitest'
import { scopeLabel, topLevelRoots, zoomedBlockUuidFromRoute } from './scope'

const UUID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'

describe('zoomedBlockUuidFromRoute', () => {
  it('reads the uuid from a zoom route', () => {
    expect(zoomedBlockUuidFromRoute(`/page/${UUID}`)).toBe(UUID)
  })

  it('accepts the hash-prefixed and trailing-slash forms', () => {
    expect(zoomedBlockUuidFromRoute(`#/page/${UUID}`)).toBe(UUID)
    expect(zoomedBlockUuidFromRoute(`/page/${UUID}/`)).toBe(UUID)
  })

  it('accepts upper-case uuids', () => {
    expect(zoomedBlockUuidFromRoute(`/page/${UUID.toUpperCase()}`)).toBe(UUID.toUpperCase())
  })

  it('returns null for normal page routes', () => {
    expect(zoomedBlockUuidFromRoute('/page/Project Notes')).toBeNull()
    expect(zoomedBlockUuidFromRoute('/page/not-a-uuid')).toBeNull()
  })

  it('returns null for journal and other routes', () => {
    expect(zoomedBlockUuidFromRoute('/journals')).toBeNull()
    expect(zoomedBlockUuidFromRoute(`/file/${UUID}`)).toBeNull()
    expect(zoomedBlockUuidFromRoute(`/pages/${UUID}`)).toBeNull()
  })
})

describe('topLevelRoots', () => {
  it('drops a root that sits inside another selected root', () => {
    const roots = [
      { uuid: 'parent', descendantUuids: ['child-a', 'child-b'] },
      { uuid: 'child-a', descendantUuids: [] },
      { uuid: 'child-b', descendantUuids: [] },
    ]
    expect(topLevelRoots(roots).map((r) => r.uuid)).toEqual(['parent'])
  })

  it('drops a nested root that is listed before its ancestor', () => {
    const roots = [
      { uuid: 'child', descendantUuids: [] },
      { uuid: 'parent', descendantUuids: ['child', 'grandchild'] },
    ]
    expect(topLevelRoots(roots).map((r) => r.uuid)).toEqual(['parent'])
  })

  it('keeps disjoint roots in the order given', () => {
    const roots = [
      { uuid: 'b', descendantUuids: ['b1'] },
      { uuid: 'a', descendantUuids: [] },
    ]
    expect(topLevelRoots(roots).map((r) => r.uuid)).toEqual(['b', 'a'])
  })

  it('keeps each root once when it is listed twice', () => {
    const roots = [
      { uuid: 'a', descendantUuids: [] },
      { uuid: 'a', descendantUuids: [] },
    ]
    expect(topLevelRoots(roots)).toHaveLength(1)
  })

  it('passes a single root through', () => {
    const roots = [{ uuid: 'only', descendantUuids: ['x'] }]
    expect(topLevelRoots(roots)).toEqual(roots)
  })
})

describe('scopeLabel', () => {
  it('labels the page, bullet, and selection scopes', () => {
    expect(scopeLabel('page', 1)).toBe('This page')
    expect(scopeLabel('focused', 1)).toBe('This bullet')
    expect(scopeLabel('selection', 3)).toBe('Selection (3)')
  })
})
