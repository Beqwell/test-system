//console.log('[TIMER] Script loaded');

let timerMinutes = parseInt(document.body.getAttribute('data-timer'));
let remainingSeconds = timerMinutes * 60;

function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimer() {
    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);

        const form = document.getElementById('test-form');
        if (form) {
            form.submit();
        }

        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 3000);
    } else {
        document.getElementById('timer').textContent = formatTime(remainingSeconds);
        remainingSeconds--;
    }
}

let timerInterval;
window.addEventListener('DOMContentLoaded', () => {
    if (!isNaN(timerMinutes) && timerMinutes > 0) {
        const timerBox = document.getElementById('timer-box');
        if (timerBox) {
            timerBox.style.display = 'block';
        }
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }
});
