import { afterEach, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { focusTrap } from './focusTrap'

afterEach(() => { document.body.replaceChildren() })

it('keeps Tab on the enabled close control while a disabled fieldset is loading', async () => {
  document.body.innerHTML = '<button id="opener">Open</button><div id="dialog"><button id="close">Close</button><fieldset disabled><input><textarea></textarea><button>Load</button></fieldset></div><button id="outside">Outside</button>'
  const opener = document.getElementById('opener')!
  opener.focus()
  const trap = focusTrap(document.getElementById('dialog')!)
  const user = userEvent.setup()
  await user.tab()
  expect(document.getElementById('close')).toHaveFocus()
  await user.tab({ shift: true })
  expect(document.getElementById('close')).toHaveFocus()
  trap.destroy()
  expect(opener).toHaveFocus()
})
