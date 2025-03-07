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

    describe('parsing', () => {
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

        it('should handle empty input', () => {
            vm.rawContents = '';
            vm.parseAndRender();
            
            expect(vm.parsedContents).to.be.an('array').that.is.empty;
        });
    });

    describe('substitutions', () => {
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
    });

    describe('markdown rendering', () => {
        beforeEach(() => {
            vm.rawContents = sampleZoomChat;
            vm.parseAndRender();
        });

        it('should format markdown correctly', () => {
            const expectedMarkdown = `- **John Smith**: (12:34:56) Hello everyone
- **John Smith**: (12:34:58) How are you?
- **Jane Doe**: (12:34:59) I'm good, thanks!`;
            expect(vm.mdForDisplay.trim()).to.equal(expectedMarkdown.trim());
        });

        it('should format wiki links correctly', () => {
            vm.useWikiLinksInMarkdown = true;
            vm.parseAndRender();
            
            const expectedMarkdown = `- [[John Smith]]: (12:34:56) Hello everyone
- [[John Smith]]: (12:34:58) How are you?
- [[Jane Doe]]: (12:34:59) I'm good, thanks!`;
            expect(vm.mdForDisplay.trim()).to.equal(expectedMarkdown.trim());
        });

        it('should exclude direct messages', () => {
            const markdownLines = vm.mdForDisplay.trim().split('\n');
            expect(markdownLines).to.have.lengthOf(3);  // Only 3 messages (excluding the direct message)
            expect(markdownLines).to.not.include('- **Jane Doe**: (12:34:57) Hi John');
        });
    });

    describe('html rendering', () => {
        beforeEach(() => {
            vm.rawContents = sampleZoomChat;
            vm.parseAndRender();
        });

        it('should create proper HTML structure', () => {
            expect(vm.htmlForDisplay.tagName).to.equal('DIV');
            expect(vm.htmlForDisplay.firstChild.tagName).to.equal('UL');
            expect(vm.htmlForDisplay.firstChild.children).to.have.lengthOf(3);  // Only 3 messages (excluding direct message)
        });

        it('should format messages correctly', () => {
            const firstMessage = vm.htmlForDisplay.firstChild.firstChild;
            expect(firstMessage.tagName).to.equal('LI');
            
            // Check all child elements in order
            const children = firstMessage.children;
            expect(children).to.have.lengthOf(4);
            
            // Check name (strong)
            expect(children[0].tagName).to.equal('STRONG');
            expect(children[0].textContent).to.equal('John Smith');
            
            // Check spacer (span with &nbsp;)
            expect(children[1].tagName).to.equal('SPAN');
            expect(children[1].innerHTML).to.equal('&nbsp;');
            
            // Check timestamp (span with time element)
            expect(children[2].tagName).to.equal('SPAN');
            expect(children[2].textContent).to.equal('(12:34:56): ');
            const timeElement = children[2].children[0];
            expect(timeElement.tagName).to.equal('TIME');
            expect(timeElement.textContent).to.equal('12:34:56');
            
            // Check message content
            expect(children[3].tagName).to.equal('SPAN');
            expect(children[3].textContent).to.equal('Hello everyone');
        });

        it('should exclude direct messages', () => {
            const messages = vm.htmlForDisplay.firstChild.children;
            const directMessage = Array.from(messages).find(msg => 
                msg.querySelector('strong')?.textContent === 'Jane Doe' && 
                msg.querySelector('span:last-child')?.textContent === 'Hi John'
            );
            expect(directMessage).to.be.undefined;
        });

        it('should create a separate print view', () => {
            expect(vm.htmlForPrint).to.not.equal(vm.htmlForDisplay);  // Different objects
            expect(vm.htmlForPrint.innerHTML).to.equal(vm.htmlForDisplay.innerHTML);  // Same content
        });
    });

    it('should reset properly', () => {
        vm.rawContents = sampleZoomChat;
        vm.parseAndRender();
        vm.reset();
        
        expect(vm.fileName).to.equal('');
        expect(vm.rawContents).to.be.null;
        expect(vm.parsedContents).to.be.an('array').that.is.empty;
    });
}); 