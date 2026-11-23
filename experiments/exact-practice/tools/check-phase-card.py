"""Clock-check the Apple phase-card actions with the pinned, prebuilt Contract runner."""
from pathlib import Path
from tempfile import TemporaryDirectory
import re
import subprocess

app = Path(__file__).resolve().parents[1]
source = (app / 'app.contract').read_text()
start = source.index('  derive nativePhaseDialog =')
end = source.index('  derive nativePractice =', start)
# The app supplies route facts and the system preference. The fixture controls only those inputs.
actions = source[start:end].replace('media.prefersReducedMotion', 'reduced').replace('route.id', 'routeId').replace('route.name', 'routeName')
# Replace the two UIKit presentation commands with an observed flag; the clock and gate actions are real.
actions = actions.replace('showModal("phase-gate")','visible = true').replace('close("phase-gate")','visible = false')
fixture = '''component App
  state visible = false
  state nativeGate = true
  state appleSession = true
  state guideCelebrate = false
  state guidePhase = "gate-practice"
  state courseCurrent = "1"
  state routeId = "1"
  state routeName = "app"
  state reduced = false
  state guideToken = 0
  action advanceGuide
    guideToken = guideToken + 1
''' + actions + '''
  action leave
    routeName = "qso"
    nativeGate = false
  action reopen
    routeName = "app"
    nativeGate = true
  action replace
    courseCurrent = "2"
  action packChange
    guidePhase = "gate-listen"
  action celebrate
    nativeGate = false
    guideCelebrate = true
  action reduce
    reduced = true
  view
    column
      button "Continue" testId="Continue" press=acceptPracticeGate
      button "Close dialog" testId="Close dialog" press=acceptPracticeGate
      button "System close" testId="System close" press=acceptPracticeGate
      button "Leave" testId="Leave" press=leave
      button "Return" testId="Return" press=reopen
      button "Next pack" testId="Next pack" press=replace
      button "Change phase" testId="Change phase" press=packChange
      button "Celebrate" testId="Celebrate" press=celebrate
      button "Reduce" testId="Reduce" press=reduce
      dialog id="phase-gate"
        text "Course card"
'''
tests = '''test "Continue and a second dismissal share the original 140 ms deadline"
  clock +1
  tap "Continue"
  expect state guideToken == 0
  clock +70
  tap "Close dialog"
  clock +69
  expect state guideToken == 0
  expect state visible == true
  clock +1
  expect state guideToken == 1
  expect state visible == false
  tap "Continue"
  clock +150
  expect state guideToken == 1

test "leaving and reopening the same gate cancels a pending dismissal"
  clock +1
  tap "Close dialog"
  clock +100
  tap "Leave"
  tap "Return"
  clock +145
  expect state guideToken == 0
  tap "Close dialog"
  clock +139
  expect state guideToken == 0
  clock +1
  expect state guideToken == 1

test "a new pack or phase owns a fresh dismissal"
  clock +1
  tap "Continue"
  clock +90
  tap "Next pack"
  clock +150
  expect state guideToken == 0
  tap "Continue"
  clock +100
  tap "Change phase"
  clock +150
  expect state guideToken == 0
  tap "Continue"
  clock +140
  expect state guideToken == 1

test "reduced motion continues without an artificial delay"
  clock +1
  tap "Reduce"
  tap "Close dialog"
  expect state guideToken == 1
  tap "Continue"
  clock +140
  expect state guideToken == 1

test "system cancel and a second contact still advance only once"
  clock +1
  tap "System close"
  clock +100
  tap "Continue"
  clock +39
  expect state guideToken == 0
  clock +1
  expect state guideToken == 1

test "the final card closes after its exit without advancing another round"
  tap "Celebrate"
  clock +1
  tap "Continue"
  clock +139
  expect state guideCelebrate == true
  clock +1
  expect state guideCelebrate == false
  expect state guideToken == 0
'''
# Use the actual events from the dialog declaration, including UIKit's post-dismiss cancel.
card = source[source.index('      dialog id="phase-gate"'):source.index('      dialog id="course-complete"')]
def handler(marker, event):
    line = next(line for line in card.splitlines() if marker in line)
    return re.search(rf'\b{event}=(\w+)',line)[1]

for label, marker, event in [
    ('Continue','testId="guided-native-continue"','press'),
    ('Close dialog','testId="guided-native-backdrop"','press'),
    ('System close','id="phase-gate"','cancel')
]:
    fixture = fixture.replace(f'testId="{label}" press=acceptPracticeGate',f'testId="{label}" press={handler(marker,event)}')

assert 'opacity=(gateExiting ? 0 : 1)' in card and 'scale=(gateExiting ? 0.96 : 1)' in card
assert 'transition=(media.prefersReducedMotion ? "none" : "opacity 140ms cubic-bezier(0.23,1,0.32,1), scale 140ms cubic-bezier(0.23,1,0.32,1)")' in card
with TemporaryDirectory(prefix='dit-phase-clock-') as work:
    path = Path(work) / 'app.contract'
    path.write_text(fixture)
    path.with_suffix('.test.contract').write_text(tests)
    result = subprocess.run([app / '.exact/checkout/target/debug/difftest','verify',path,
                             '--runner-only','--walks','0','--steps','1','--confirm','0'],
                            cwd=work, capture_output=True, text=True)
    for line in (result.stdout + result.stderr).splitlines():
        if line.startswith(('WHOLE ', 'NOTE ', 'REFUSED ', 'runner:')) or result.returncode:
            print(line)
    if result.returncode:
        raise SystemExit(result.returncode)
    assert 'does not hold' not in result.stdout + result.stderr, 'Clock expectation failed'
    assert result.stdout.count('WHOLE ') == tests.count('test "'), 'Some clock cases were omitted'
