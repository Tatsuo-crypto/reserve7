const fs = require('fs');
const content = fs.readFileSync('src/app/admin/diet-plan/page.tsx', 'utf8');

function checkBrackets(text) {
    const stack = [];
    const openers = ['{', '(', '['];
    const closers = ['}', ')', ']'];
    const pairs = { '}': '{', ')': '(', ']': '[' };
    
    let line = 1;
    let col = 1;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '\n') {
            line++;
            col = 1;
        } else {
            col++;
        }
        
        if (openers.includes(char)) {
            stack.push({ char, line, col });
        } else if (closers.includes(char)) {
            if (stack.length === 0) {
                console.log(`Unmatched closer '${char}' at line ${line}, col ${col}`);
                continue;
            }
            const last = stack.pop();
            if (last.char !== pairs[char]) {
                console.log(`Mismatched closer '${char}' at line ${line}, col ${col}. Expected closer for '${last.char}' from line ${last.line}, col ${last.col}`);
            }
        }
    }
    
    while (stack.length > 0) {
        const remaining = stack.pop();
        console.log(`Unclosed opener '${remaining.char}' at line ${remaining.line}, col ${remaining.col}`);
    }
}

checkBrackets(content);
