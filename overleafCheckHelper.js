// ==UserScript==
// @name         Overleaf Text Change Monitor
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  监视Overleaf编辑器内容变化并自动检查公式和缩写
// @author       You
// @match        https://cn.overleaf.com/project/*
// @match        https://www.overleaf.com/project/*
// @icon         https://www.google.com/s2/favicons?domain=overleaf.com
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 添加CSS样式
    GM_addStyle(`
        #floating-window {
            position: fixed;
            top: 100px;
            left: 100px;
            width: 300px;
            height: 400px;
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            overflow: hidden;
            cursor: move;
        }
        #floating-header {
            padding: 5px 10px;
            background-color: #e9ecef;
            border-bottom: 1px solid #dee2e6;
            font-weight: bold;
        }
        #floating-content {
            padding: 10px;
            height: calc(100% - 30px);
            overflow-y: auto;
        }
        .notification {
            margin-bottom: 5px;
            padding: 3px;
            background-color: #e2f3ff;
            border-radius: 3px;
            font-size: 12px;
        }
        .highlight {
            background-color: #fff3cd;
        }
        .error-result {
            margin: 5px 0;
            padding: 5px;
            background-color: #ffe8e8;
            border-radius: 3px;
            font-size: 12px;
        }

        .cm-highlight {
            background-color: #fff3cd;
            transition: background-color 2s ease-out;
        }
    `);

    // 创建浮动窗口
    const floatingWindow = document.createElement('div');
    floatingWindow.id = 'floating-window';
    floatingWindow.innerHTML = `
        <div id="floating-header">Overleaf 监视器</div>
        <div id="floating-content"></div>
    `;
    document.body.appendChild(floatingWindow);

    // 使窗口可拖动
    let isDragging = false;
    let offsetX, offsetY;
    const header = floatingWindow.querySelector('#floating-header');

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - floatingWindow.getBoundingClientRect().left;
        offsetY = e.clientY - floatingWindow.getBoundingClientRect().top;
        floatingWindow.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        floatingWindow.style.left = (e.clientX - offsetX) + 'px';
        floatingWindow.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        floatingWindow.style.cursor = 'move';
    });

    // 添加通知到浮动窗口
    const addNotification = (message) => {
        const content = floatingWindow.querySelector('#floating-content');
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        content.appendChild(notification);
        content.scrollTop = content.scrollHeight;
    };

    // 添加错误结果到浮动窗口
    const addErrorResult = (errorType, lines) => {
        const content = floatingWindow.querySelector('#floating-content');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-result';

        // 创建行数链接
        const lineLinks = lines.map(line => {
            const link = document.createElement('a');
            link.textContent = line;
            link.href = 'javascript:void(0)';
            link.style.cursor = 'pointer';
            link.style.margin = '0 2px';
            link.style.textDecoration = 'underline';
            link.style.color = '#007bff';
            link.addEventListener('click', () => {
                goToLine(line);
                // 添加短暂高亮效果
                const view = document.querySelector('.cm-content').cmView.view;
                const lineObj = view.state.doc.line(line);
                view.dispatch({
                    effects: [
                        view.state.effects.highlight.of([{
                            from: lineObj.from,
                            to: lineObj.to,
                            class: 'highlight'
                        }])
                    ]
                });
                // 2秒后移除高亮
                setTimeout(() => {
                    view.dispatch({
                        effects: [
                            view.state.effects.highlight.of([])
                        ]
                    });
                }, 2000);
            });
            return link;
        });
        // 创建分隔文本节点
        const separators = lines.map((_, i) => {
            return i < lines.length - 1 ? document.createTextNode('、') : null;
        }).filter(Boolean);
        // 组装所有元素
        const fragment = document.createDocumentFragment();
        fragment.appendChild(document.createTextNode(`错误（${errorType}）所在行数：`));

        lineLinks.forEach((link, i) => {
            fragment.appendChild(link);
            if (separators[i]) {
                fragment.appendChild(separators[i]);
            }
        });
        errorDiv.appendChild(fragment);
        content.appendChild(errorDiv);
        content.scrollTop = content.scrollHeight;
    };

    // 清空浮动窗口内容
    const clearFloatingContent = () => {
        const content = floatingWindow.querySelector('#floating-content');
        content.innerHTML = '';
    };

    function goToLine(n) {
        const view = document.querySelector('.cm-content').cmView.view;
        const EditorView = view.constructor;

        const line = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, n)));

        view.dispatch({
            selection: { anchor: line.from },
            effects: [
                EditorView.scrollIntoView(line.from, {
                    y: 'center'
                })
            ]
        });
        view.focus();
    }

    function checkEquationEnd(inputText) {
        const result = {
            "公式末尾缺乏标点": []
        };
        const regex = /([^., ])\s*(?<!\\)(?:\\\\)\s*\n\s*\\end{equation}/g;
        const lines = inputText.split('\n');
        let match;
        while ((match = regex.exec(inputText)) !== null) {
            console.log(match[1]);
            const matchStartIndex = match.index;
            let lineNumber = 1;
            let charCount = 0;
            for (let i = 0; i < lines.length; i++) {
                charCount += lines[i].length + 1;
                if (matchStartIndex < charCount) {
                    lineNumber = i + 1;
                    break;
                }
            }
            result["公式末尾缺乏标点"].push(lineNumber);
        }
        return result;
    }

    function checkDuplicateAbbreviations(inputText) {
        const result = {
            "存在重复定义的缩写": []
        };

        const seenAbbreviations = new Set();
        const lines = inputText.split('\n');
        const regex = /\(([^() ]+)\)/g;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;
            let match;

            while ((match = regex.exec(line)) !== null) {
                const abbreviation = match[1];

                if (seenAbbreviations.has(abbreviation) && !['a', 'b', '1', '2', '3', 'lr'].includes(abbreviation)) {
                    // 如果是重复的，添加到结果中
                    if (!result["存在重复定义的缩写"].includes(lineNumber)) {
                        console.log(abbreviation);
                        result["存在重复定义的缩写"].push(lineNumber);
                    }
                } else {
                    seenAbbreviations.add(abbreviation);
                }
            }
        }

        return result;
    }


    function extractNewCommands(inputText) {
        const regex = /\\newcommand{\\([^}]+)}/g;
        const commands = [];
        let match;

        while ((match = regex.exec(inputText)) !== null) {
            commands.push(match[1]);
        }

        return commands;
    }

    function checkSpaceAfterCommand(inputText) {
        const result = {
            "未处理变量名后的空格": []
        };

        const commands = extractNewCommands(inputText);

        if (commands.length === 0) {
            return result;
        }

        const commandRegex = new RegExp(`\\\\(${commands.join('|')}) +([^&])`, 'g');
        const lines = inputText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;
            let match;

            while ((match = commandRegex.exec(line)) !== null) {
                if (!result["未处理变量名后的空格"].includes(lineNumber)) {
                    result["未处理变量名后的空格"].push(lineNumber);
                }
            }
            // 重置正则表达式的lastIndex，以便下次循环能正确匹配
            commandRegex.lastIndex = 0;
        }

        return result;
    }


    function checkLatexQuotes(inputText) {
        const result = {
            "latex引号使用不当": []
        };

        const regex = /(?:'[^`']+'(?![^'])|''[^`'"]+''(?![^`'])|"[^`'"]+''(?![^`'])|''[^`'"]+"(?![^`']))/g;

        const lines = inputText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let match;

            regex.lastIndex = 0;

            if ((match = regex.exec(line)) !== null) {
                result["latex引号使用不当"].push(i + 1);
            }
        }

        return result;
    }

    function checkDashes(inputText) {
        const result = {
            "横符使用不当": []
        };

        const dashRegex = /–|—/g;

        const lines = inputText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            dashRegex.lastIndex = 0;
            if (dashRegex.test(line)) {
                result["横符使用不当"].push(i + 1);
            }
        }
        return result;
    }

    function checkPoint(inputText) {
        const result = {
            "句号使用不当": []
        };

        const lines = inputText.split('\n');

        const pattern = /(\s\.|\.(?!com|org|net|gov|edu)[a-zA-Z])/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (pattern.test(line)) {
                result["句号使用不当"].push(i + 1);
            }
        }

        return result;
    }

    function checkWhereAfterEquation(inputText) {
        const result = {
            "公式后面的where位置不对": []
        };

        const regex = /\\end\{equation\}\s*(?:\n\s*){2,}where/gi;
        const lines = inputText.split('\n');

        let match;
        while ((match = regex.exec(inputText)) !== null) {
            const matchStartIndex = match.index;
            let lineNumber = 1;
            let charCount = 0;

            for (let i = 0; i < lines.length; i++) {
                charCount += lines[i].length + 1;

                if (matchStartIndex < charCount) {
                    lineNumber = i + 1;
                    break;
                }
            }

            result["公式后面的where位置不对"].push(lineNumber);
        }

        return result;
    }

    function checkAdjacentCitation(inputText) {
        const result = {
            "连续引用未合并": []
        };

        if (!inputText) return result;

        const lines = inputText.split('\n');
        const pattern = /\\cite\{[^}]+\}\\cite\{[^}]+\}/g;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const matches = line.match(pattern);

            if (matches && matches.length > 0) {
                result["连续引用未合并"].push(i + 1);
            }
        }

        return result;
    }

    // 总检查函数
    const performAllChecks = (currentContent) => {
        clearFloatingContent();
        addNotification('正在检查文档内容...');

        // 检查公式错误
        const equationResult = checkEquationEnd(currentContent);
        // 检查重复缩写
        const abbreviationResult = checkDuplicateAbbreviations(currentContent);
        // 检查是否处理变量后的空格
        const spaceAfterCommandResult = checkSpaceAfterCommand(currentContent);
        // 检查latex格式的引用使用
        const latexQuotesResult = checkLatexQuotes(currentContent);
        // 检查横符使用情况
        const dashesResult = checkDashes(currentContent);
        // 检查句号使用情况
        const pointResult = checkPoint(currentContent);
        // 检查公式后面的where是否靠近
        const whereAfterEquationResult = checkWhereAfterEquation(currentContent);
        // 检查连续引用情况
        const adjacentCitationResult = checkAdjacentCitation(currentContent);

        // 合并检查结果
        const allResults = {
            ...equationResult,
            ...abbreviationResult,
            ...spaceAfterCommandResult,
            ...latexQuotesResult,
            ...dashesResult,
            ...pointResult,
            ...whereAfterEquationResult,
            ...adjacentCitationResult
        };

        // 显示所有检查结果
        for (const [errorType, lines] of Object.entries(allResults)) {
            if (lines.length > 0) {
                addErrorResult(errorType, lines);
            }
        }

        if (Object.values(allResults).every(arr => arr.length === 0)) {
            addNotification('检查完成，未发现问题。');
        } else {
            addNotification('检查完成，请查看上方错误。');
        }
    };

    // 存储上一次的内容
    let lastContent = '';
    let isFirstRun = true;

    // 检查内容是否变化
    const checkContentChange = () => {
        try {
            const currentContent = document.querySelector('.cm-content').cmView.view.state.doc.toString().replace(/(?<!\\)%[^\n]*\n/g, '\n');

            if (isFirstRun) {
                lastContent = currentContent;
                isFirstRun = false;
                addNotification('监视器已启动，正在监听内容变化...');
                // 初始化时执行一次检查
                performAllChecks(currentContent);
                return;
            }

            if (currentContent !== lastContent) {
                lastContent = currentContent;
                // 内容变化时执行检查
                performAllChecks(currentContent);
            }
        } catch (error) {
            addNotification(`获取内容时出错: ${error.message}`);
        }
    };

    // 监视编辑器内容变化
    const observeEditorChanges = () => {
        const editor = document.querySelector('.cm-content.cm-lineWrapping');
        if (!editor) {
            setTimeout(observeEditorChanges, 500);
            return;
        }

        // 使用MutationObserver监视变化
        const observer = new MutationObserver((mutations) => {
            // 延迟检查以避免频繁触发
            setTimeout(checkContentChange, 300);
        });

        observer.observe(editor, {
            childList: true,
            subtree: true,
            characterData: true
        });

        addNotification('已开始监视编辑器内容变化');
    };

    // 启动监视
    observeEditorChanges();
})();
