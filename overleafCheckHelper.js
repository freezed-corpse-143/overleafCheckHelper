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

    function extractNewCommands(inputText) {
        const regex = /\\newcommand{\\([^}]+)}/g;
        const commands = [];
        let match;

        while ((match = regex.exec(inputText)) !== null) {
            commands.push(match[1]);
        }

        return commands;
    }

    // 定义检查函数列表
    const checkFunctions = [
        {
            name: "公式末尾缺乏标点",
            func: (inputText) => {
                const result = [];
                const regex = /([^., ])\s*(?<!\\)(?:\\\\)\s*\n\s*\\end{equation}/g;
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
                    result.push(lineNumber);
                }
                return result;
            }
        },
        {
            name: "存在重复定义的缩写",
            func: (inputText) => {
                const result = [];
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
                            if (!result.includes(lineNumber)) {
                                result.push(lineNumber);
                            }
                        } else {
                            seenAbbreviations.add(abbreviation);
                        }
                    }
                }
                return result;
            }
        },
        {
            name: "变量后未添加{}",
            func: (inputText) => {
                const result = [];
                const commands = extractNewCommands(inputText);

                if (commands.length === 0) {
                    return result;
                }

                const commandRegex = new RegExp(`\\\\(${commands.join('|')})(?![{]|$)`, 'g');
                const newCommandRegex = /\\newcommand/;
                const lines = inputText.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNumber = i + 1;

                    // 跳过包含 \newcommand 的行
                    if (newCommandRegex.test(line)) {
                        continue;
                    }

                    let match;
                    while ((match = commandRegex.exec(line)) !== null) {
                        if (!result.includes(lineNumber)) {
                            result.push(lineNumber);
                        }
                    }
                    commandRegex.lastIndex = 0;
                }
                return result;
            }
        },
        {
            name: "latex引号使用不当",
            func: (inputText) => {
                const result = [];
                const regex = /(?:'[^`']+'(?![^'])|''[^`'"]+''(?![^`'])|"[^`'"]+''(?![^`'])|''[^`'"]+"(?![^`']))/g;
                const lines = inputText.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    let match;

                    regex.lastIndex = 0;
                    if ((match = regex.exec(line)) !== null) {
                        result.push(i + 1);
                    }
                }
                return result;
            }
        },
        {
            name: "横符使用不当",
            func: (inputText) => {
                const result = [];
                const dashRegex = /–|—/g;
                const lines = inputText.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    dashRegex.lastIndex = 0;
                    if (dashRegex.test(line)) {
                        result.push(i + 1);
                    }
                }
                return result;
            }
        },
        {
            name: "句号使用不当",
            func: (inputText) => {
                const result = [];
                const lines = inputText.split('\n');
                const pattern = /(\s\.|\.(?!com|org|net|gov|edu|\})[a-zA-Z])/;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.includes("e.g.") && pattern.test(line)) {
                        result.push(i + 1);
                    }
                }
                return result;
            }
        },
        {
            name: "公式后面的where位置不对",
            func: (inputText) => {
                const result = [];
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
                    result.push(lineNumber);
                }
                return result;
            }
        },
        {
            name: "连续引用未合并",
            func: (inputText) => {
                const result = [];
                if (!inputText) return result;

                const lines = inputText.split('\n');
                const pattern = /\\cite\{[^}]+\}\\cite\{[^}]+\}/g;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const matches = line.match(pattern);

                    if (matches && matches.length > 0) {
                        result.push(i + 1);
                    }
                }
                return result;
            }
        },
        {
            name: "method不应用于自己",
            func: (inputText) => {
                const lines = inputText.split('\n');
                let positions = [];

                const regex = /\b(?:our|Our) method\b[^A-Za-z]/gi;

                lines.forEach((line, index) => {
                    if(regex.test(line)) {
                        positions.push(index + 1);
                    }
                });
                return positions;
            }
        },
        {
            name: "section中的单词没有都首字母大写",
            func: (inputText) => {
                const lines = inputText.split('\n');
                const resultLines = [];

                const extractOuterBracesContent = (str) => {
                    let stack = [];
                    let startIndex = -1;
                    for (let i = 0; i < str.length; i++) {
                        if (str[i] === '{') {
                            if (!stack.length) {
                                startIndex = i;
                            }
                            stack.push('{');
                        } else if (str[i] === '}') {
                            stack.pop();
                            if (!stack.length) {
                                return str.substring(startIndex + 1, i);
                            }
                        }
                    }
                    return null;
                };

                const sectionPattern = /\\[A-Za-z]*section/;

                lines.forEach((line, index) => {
                    if (sectionPattern.test(line)) {
                        const content = extractOuterBracesContent(line);
                        if (content) {
                            const wordPattern = /\s[a-z]\w*/;
                            if (wordPattern.test(content)) {
                                resultLines.push(index + 1);
                            }
                        }
                    }
                });

                return resultLines;
            }
        },
        {
            name: "缩写未被使用",
            func: (inputText) => {
                const result = [];
                const abbreviationPositions = {};
                const usageCount = {};
                const lines = inputText.split('\n');
                const regex = /\(([^() ]+)\)/g;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNumber = i + 1;
                    let match;

                    while ((match = regex.exec(line)) !== null) {
                        const abbreviation = match[1];

                        if (/^[a-zA-Z]+$/.test(abbreviation) && !['a', 'b', '1', '2', '3', 'lr', 'R'].includes(abbreviation)) {
                            if (!abbreviationPositions[abbreviation]) {
                                abbreviationPositions[abbreviation] = lineNumber;
                                usageCount[abbreviation] = 1;
                            }
                        }

                    }
                }

                const allAbbreviations = Object.keys(abbreviationPositions);

                for (const abbreviation of allAbbreviations) {
                    const usageRegex = new RegExp(`\\s${abbreviation}([^a-zA-Z]|$)`, 'g');

                    const matches = inputText.match(usageRegex);

                    if (matches && matches.length > 0) {
                        usageCount[abbreviation] += 1;
                    }
                }

                // 检查使用次数为1的缩写（只被定义，未被使用）
                for (const [abbreviation, count] of Object.entries(usageCount)) {
                    if (count === 1) {
                        result.push(abbreviationPositions[abbreviation]);
                    }
                }

                return result;
            }
        },
        {
            name: "图表缺乏标签属性",
            func: (inputText) => {
                const lines = inputText.split('\n');
                const result = [];
                let inChart = false;
                let hasLabel = false;
                let chartStartLine = 0;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNumber = i + 1;

                    // 检测图表开始
                    if (line.includes('\\begin{table*}') || line.includes('\\begin{table}') || 
                        line.includes('\\begin{figure*}') || line.includes('\\begin{figure}')) {
                        inChart = true;
                        hasLabel = false;
                        chartStartLine = lineNumber;
                    }

                    // 检测label
                    if (inChart && line.includes('\\label')) {
                        hasLabel = true;
                    }

                    // 检测图表结束
                    if (inChart && (line.includes('\\end{table*}') || line.includes('\\end{table}') || 
                        line.includes('\\end{figure*}') || line.includes('\\end{figure}'))) {
                        if (!hasLabel) {
                            result.push(lineNumber);
                        }
                        inChart = false;
                        hasLabel = false;
                    }
                }

                return result;
            }
        },
        {
            name: "图表未被引用",
            func: (inputText) => {
                const lines = inputText.split('\n');
                const labelDict = {};
                let inChart = false;
                const output = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNumber = i + 1;

                    // 检测图表开始
                    if (line.includes('\\begin{table*}') || line.includes('\\begin{table}') ||
                        line.includes('\\begin{figure*}') || line.includes('\\begin{figure}')) {
                        inChart = true;
                    }

                    // 在图表范围内检测label
                    if (inChart) {
                        const labelMatch = line.match(/\\label\{([^}]+)\}/);
                        if (labelMatch) {
                            const labelKey = labelMatch[1];
                            labelDict[labelKey] = lineNumber;
                        }
                    }

                    // 检测图表结束
                    if (inChart && (line.includes('\\end{table*}') || line.includes('\\end{table}') ||
                                    line.includes('\\end{figure*}') || line.includes('\\end{figure}'))) {
                        inChart = false;
                    }
                }

                // 第二遍遍历：检查每个标签是否被引用
                for (const [labelKey, lineNumber] of Object.entries(labelDict)) {
                    const refPattern = new RegExp(`\\\\ref\\{${labelKey}\\}`);
                    if (!refPattern.test(inputText)) {
                        output.push(lineNumber);
                    }
                }

                return output;
            }
        },
        {
            name: "不是~\\ref",
            func: (inputText) => {
                const lines = inputText.split('\n');
                const result = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const refIndex = line.indexOf('\\ref');

                    if (refIndex !== -1) {
                        if (refIndex >= 2) {
                            const prevTwoChars = line.substring(refIndex - 2, refIndex);
                            if (!/^[a-zA-Z]~$/.test(prevTwoChars)) {
                                result.push(i + 1);
                            }
                        } else {
                            result.push(i + 1);
                        }
                    }
                }

                return result;
            }
        },
        {
            name: "\\begin\{itemize\}与上个段落之间超过1个换行符",
            func: (inputText) => {
                const lines = inputText.split('\n');
                const result = [];

                for (let i = 0; i < lines.length; i++) {
                    const currentLine = lines[i];

                    if (currentLine.includes('\\begin{itemize}')) {
                        // 检查上一行是否存在且为空字符串
                        if (i > 0 && lines[i - 1].trim() === '') {
                            // 行位置为索引+1
                            result.push(i + 1);
                        }
                    }
                }

                return result;
            }
        }
    ];

    // 总检查函数
    const performAllChecks = (currentContent) => {
        clearFloatingContent();
        addNotification('正在检查文档内容...');

        const allResults = {};

        // 遍历检查函数列表
        checkFunctions.forEach(check => {
            const result = check.func(currentContent);
            if (result.length > 0) {
                allResults[check.name] = result;
            }
        });

        // 显示所有检查结果
        for (const [errorType, lines] of Object.entries(allResults)) {
            addErrorResult(errorType, lines);
        }

        if (Object.keys(allResults).length === 0) {
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
