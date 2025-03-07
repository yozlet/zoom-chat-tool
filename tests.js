// Set up JSDOM for Node environment
if (typeof window === 'undefined') {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    
    // Set up localStorage mock
    const localStorageMock = {
        store: {},
        getItem: function(key) {
            return this.store[key] || null;
        },
        setItem: function(key, value) {
            this.store[key] = value;
        },
        clear: function() {
            this.store = {};
        }
    };
    global.window.localStorage = localStorageMock;
}

// Test data
const sampleZoomChat = `12:34:56 From John Smith: Hello everyone
12:34:57 From Jane Doe to John Smith: Hi John
12:34:58 From John Smith: How are you?
12:34:59 From Jane Doe: I'm good, thanks!`;

describe('substitutionsViewModel', () => {
    let vm;

    beforeEach(() => {
        // Clear the singleton instance before each test
        substitutionsViewModel.clearInstance();
        vm = new substitutionsViewModel(() => {});
        // Clear localStorage before each test
        window.localStorage.clear();
    });

    afterEach(() => {
        // Clean up after each test
        substitutionsViewModel.clearInstance();
    });

    it('should add a replacement', () => {
        vm.addReplacement('John Smith', 'Johnny');
        expect(vm.liveCopy).to.have.lengthOf(1);
        expect(vm.liveCopy[0].SEARCH_KEY).to.equal('John Smith');
        expect(vm.liveCopy[0].REPLACEMENT_VALUE).to.equal('Johnny');
    });

    it('should apply new settings', () => {
        const newSettings = [
            { SEARCH_KEY: 'John', REPLACEMENT_VALUE: 'Johnny' },
            { SEARCH_KEY: 'Jane', REPLACEMENT_VALUE: 'Janey' }
        ];
        vm.applyNewSettings(newSettings);
        expect(vm.liveCopy).to.have.lengthOf(2);
        expect(vm.liveCopy[0].SEARCH_KEY).to.equal('John');
        expect(vm.liveCopy[1].REPLACEMENT_VALUE).to.equal('Janey');
    });

    it('should reset to empty state', () => {
        vm.addReplacement('John', 'Johnny');
        vm.reset();
        expect(vm.liveCopy).to.be.an('array').that.is.empty;
    });

    it('should persist and load from localStorage', () => {
        // Test persistence
        vm.addReplacement('John', 'Johnny');
        const storedValue = window.localStorage.getItem(substitutionsViewModel.REPLACEMENT_SETTINGS_KEY);
        expect(storedValue).to.exist;
        expect(JSON.parse(storedValue)).to.deep.equal([{ SEARCH_KEY: 'John', REPLACEMENT_VALUE: 'Johnny' }]);

        // Test loading
        const newVm = new substitutionsViewModel(() => {});
        newVm.populateFromBrowser();
        expect(newVm.liveCopy).to.have.lengthOf(1);
        expect(newVm.liveCopy[0].SEARCH_KEY).to.equal('John');
    });

    it('should maintain singleton pattern', () => {
        const vm2 = new substitutionsViewModel(() => {});
        expect(vm2).to.equal(vm);  // Should be the same instance
    });
});

describe('fileViewModel', () => {
    let vm;

    beforeEach(() => {
        vm = new fileViewModel(() => {});
    });

    it('should parse chat log correctly', () => {
        vm.rawContents = sampleZoomChat;
        vm.parseAndRender();
        
        expect(vm.parsedContents).to.have.lengthOf(4);  // All messages are parsed
        expect(vm.parsedContents[0]).to.deep.include({
            from: 'John Smith',
            contents: 'Hello everyone',
            to: 'Everyone'
        });
        expect(vm.parsedContents[1]).to.deep.include({
            from: 'Jane Doe',
            contents: 'Hi John',
            to: 'John Smith'
        });
        expect(vm.parsedContents[2]).to.deep.include({
            from: 'John Smith',
            contents: 'How are you?',
            to: 'Everyone'
        });
        expect(vm.parsedContents[3]).to.deep.include({
            from: 'Jane Doe',
            contents: "I'm good, thanks!",
            to: 'Everyone'
        });
    });

    it('should apply substitutions', () => {
        vm.rawContents = sampleZoomChat;
        vm.substitutions = [
            { SEARCH_KEY: 'John Smith', REPLACEMENT_VALUE: 'Johnny' }
        ];
        vm.applyFilter();
        vm.parseAndRender();
        
        expect(vm.parsedContents[0].from).to.equal('Johnny');
        expect(vm.parsedContents[1].from).to.equal('Jane Doe');
    });

    it('should format markdown correctly', () => {
        vm.rawContents = sampleZoomChat;
        vm.parseAndRender();
        
        const expectedMarkdown = `- **John Smith**: (12:34:56) Hello everyone
- **John Smith**: (12:34:58) How are you?
- **Jane Doe**: (12:34:59) I'm good, thanks!`;
        expect(vm.mdForDisplay.trim()).to.equal(expectedMarkdown.trim());
    });

    it('should format wiki links correctly', () => {
        vm.rawContents = sampleZoomChat;
        vm.useWikiLinksInMarkdown = true;
        vm.parseAndRender();
        
        const expectedMarkdown = `- [[John Smith]]: (12:34:56) Hello everyone
- [[John Smith]]: (12:34:58) How are you?
- [[Jane Doe]]: (12:34:59) I'm good, thanks!`;
        expect(vm.mdForDisplay.trim()).to.equal(expectedMarkdown.trim());
    });

    it('should exclude direct messages', () => {
        vm.rawContents = sampleZoomChat;
        vm.parseAndRender();
        
        // Check that direct messages are excluded from markdown output
        const markdownLines = vm.mdForDisplay.trim().split('\n');
        expect(markdownLines).to.have.lengthOf(3);  // Only 3 messages (excluding the direct message)
        expect(markdownLines).to.not.include('- **Jane Doe**: (12:34:57) Hi John');
    });

    it('should handle empty input', () => {
        vm.rawContents = '';
        vm.parseAndRender();
        
        expect(vm.parsedContents).to.be.an('array').that.is.empty;
    });

    it('should reset properly', () => {
        vm.rawContents = sampleZoomChat;
        vm.parseAndRender();
        vm.reset();
        
        expect(vm.fileName).to.equal('');
        expect(vm.rawContents).to.be.null;
        expect(vm.parsedContents).to.be.an('array').that.is.empty;
    });

    it('should filter direct messages in markdown output', () => {
        vm.rawContents = sampleZoomChat;
        vm.parseAndRender();
        
        const expectedMarkdown = `- **John Smith**: (12:34:56) Hello everyone
- **John Smith**: (12:34:58) How are you?
- **Jane Doe**: (12:34:59) I'm good, thanks!`;
        expect(vm.mdForDisplay.trim()).to.equal(expectedMarkdown.trim());
    });
}); 