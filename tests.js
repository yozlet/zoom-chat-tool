// Simple test utilities
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Test failed: ${message}`);
    }
}

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name} passed`);
    } catch (error) {
        console.error(`❌ ${name} failed:`, error.message);
    }
}

// Test data
const sampleZoomChat = `12:34:56 From John Smith: Hello everyone
12:34:57 From Jane Doe to John Smith: Hi John
12:34:58 From John Smith: How are you?
12:34:59 From Jane Doe: I'm good, thanks!`;

// Test substitutionsViewModel
test('substitutionsViewModel - addReplacement', () => {
    const vm = new substitutionsViewModel(() => {});
    vm.addReplacement('John Smith', 'Johnny');
    assert(vm.liveCopy.length === 1, 'Should have one replacement');
    assert(vm.liveCopy[0].SEARCH_KEY === 'John Smith', 'Search key should match');
    assert(vm.liveCopy[0].REPLACEMENT_VALUE === 'Johnny', 'Replacement value should match');
});

test('substitutionsViewModel - applyNewSettings', () => {
    const vm = new substitutionsViewModel(() => {});
    const newSettings = [
        { SEARCH_KEY: 'John', REPLACEMENT_VALUE: 'Johnny' },
        { SEARCH_KEY: 'Jane', REPLACEMENT_VALUE: 'Janey' }
    ];
    vm.applyNewSettings(newSettings);
    assert(vm.liveCopy.length === 2, 'Should have two replacements');
    assert(vm.liveCopy[0].SEARCH_KEY === 'John', 'First search key should match');
    assert(vm.liveCopy[1].REPLACEMENT_VALUE === 'Janey', 'Second replacement value should match');
});

// Test fileViewModel
test('fileViewModel - parse chat log', () => {
    const vm = new fileViewModel(() => {});
    vm.rawContents = sampleZoomChat;
    vm.parseAndRender();
    
    assert(vm.parsedContents.length === 2, 'Should parse 2 messages (excluding direct messages)');
    assert(vm.parsedContents[0].from === 'John Smith', 'First message should be from John Smith');
    assert(vm.parsedContents[0].contents === 'Hello everyone', 'First message content should match');
    assert(vm.parsedContents[1].from === 'Jane Doe', 'Second message should be from Jane Doe');
    assert(vm.parsedContents[1].contents === "I'm good, thanks!", 'Second message content should match');
});

test('fileViewModel - apply substitutions', () => {
    const vm = new fileViewModel(() => {});
    vm.rawContents = sampleZoomChat;
    vm.substitutions = [
        { SEARCH_KEY: 'John Smith', REPLACEMENT_VALUE: 'Johnny' }
    ];
    vm.applyFilter();
    vm.parseAndRender();
    
    assert(vm.parsedContents[0].from === 'Johnny', 'Name should be replaced');
    assert(vm.parsedContents[1].from === 'Jane Doe', 'Other names should remain unchanged');
});

test('fileViewModel - markdown formatting', () => {
    const vm = new fileViewModel(() => {});
    vm.rawContents = sampleZoomChat;
    vm.parseAndRender();
    
    const expectedMarkdown = `- **John Smith**: (12:34:56) Hello everyone
- **Jane Doe**: (12:34:59) I'm good, thanks!`;
    assert(vm.mdForDisplay.trim() === expectedMarkdown.trim(), 'Markdown output should match expected format');
});

test('fileViewModel - wiki link markdown formatting', () => {
    const vm = new fileViewModel(() => {});
    vm.rawContents = sampleZoomChat;
    vm.useWikiLinksInMarkdown = true;
    vm.parseAndRender();
    
    const expectedMarkdown = `- [[John Smith]]: (12:34:56) Hello everyone
- [[Jane Doe]]: (12:34:59) I'm good, thanks!`;
    assert(vm.mdForDisplay.trim() === expectedMarkdown.trim(), 'Wiki link markdown output should match expected format');
}); 