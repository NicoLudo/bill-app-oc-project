/**
 * @jest-environment jsdom
 */

import { screen, fireEvent, waitFor } from "@testing-library/dom";
import '@testing-library/jest-dom/extend-expect';
import NewBillUI from "../views/NewBillUI.js";
import NewBill from "../containers/NewBill.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import store from "../__mocks__/store.js";
import { ROUTES_PATH, ROUTES } from '../constants/routes.js';

const setupEnvironment = () => {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  Object.defineProperty(window, 'location', { value: { hash: ROUTES_PATH['NewBill'] } });
  window.localStorage.setItem('user', JSON.stringify({
    type: 'Employee',
    email: 'employee@test.tld',
  }));
  document.body.innerHTML = NewBillUI();
};

const createNewBillInstance = () => new NewBill({ document, onNavigate: jest.fn(), store, localStorage: window.localStorage });

const fillFormFields = (data) => {
  Object.entries(data).forEach(([key, value]) => {
    fireEvent.change(screen.getByTestId(key), { target: { value } });
  });
};

describe("Given I am connected as an employee", () => {
  beforeAll(() => {
    setupEnvironment();
  });

  describe("When I am on NewBill Page", () => {
    test("Then the new bill form should be displayed", () => {
      expect(screen.getByTestId('form-new-bill')).toBeTruthy();
    });
  });

  describe("When I upload a file", () => {
    let newBill;

    beforeEach(() => {
      newBill = createNewBillInstance();
      window.alert = jest.fn();
    });

    const testFileUpload = async (file, shouldAlert) => {
      const fileInput = screen.getByTestId('file');
      fireEvent.change(fileInput, { target: { files: [file] } });

      if (shouldAlert) {
        expect(newBill.isFileValid).toBe(false);
      } else {
        expect(newBill.isFileValid).toBe(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('email', JSON.parse(localStorage.getItem("user")).email);

        store.bills().create = jest.fn().mockResolvedValue({
          fileUrl: 'https://localhost:3456/images/test.jpg',
          key: '1234'
        });

        await newBill.handleChangeFile({ target: { files: [file] }, preventDefault: jest.fn() });

        expect(store.bills().create).toHaveBeenCalledWith({
          data: formData,
          headers: { noContentType: true }
        });

        await waitFor(() => {
          expect(newBill.billId).toBe('1234');
          expect(newBill.fileUrl).toBe('https://localhost:3456/images/test.jpg');
          expect(newBill.fileName).toBe(file.name);
        });
      }
    };

    test("with an invalid extension, it should display an alert", async () => {
      await testFileUpload(new File(['text'], 'foo.txt', { type: 'text/plain' }), true);
    });

    test("with a valid extension, it should update the file input and not display an alert", async () => {
      await testFileUpload(new File(['image'], 'image.png', { type: 'image/png' }), false);
    });
  });

  describe("When I submit the form", () => {
    let newBill;

    beforeEach(() => {
      newBill = createNewBillInstance();
      store.bills = jest.fn(() => ({
        create: jest.fn().mockResolvedValue({ key: '1234' }),
        update: jest.fn().mockResolvedValue({})
      }));
    });

    test("with valid data, it should create a new bill and navigate to Bills page", async () => {
      const onNavigate = jest.fn((pathname) => {
        document.body.innerHTML = ROUTES({ pathname });
      });

      newBill = new NewBill({ document, onNavigate, store, localStorage: window.localStorage });

      fillFormFields({
        'expense-type': 'Transports',
        'expense-name': 'Vol Paris Londres',
        'datepicker': '2023-01-01',
        'amount': '100',
        'vat': '20',
        'pct': '20',
        'commentary': 'Commentaire'
      });

      const handleSubmit = jest.spyOn(newBill, 'handleSubmit');
      screen.getByTestId('form-new-bill').addEventListener('submit', handleSubmit);

      fireEvent.submit(screen.getByTestId('form-new-bill'));

      expect(handleSubmit).toHaveBeenCalled();

      await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH.Bills));
      expect(screen.getByText('Mes notes de frais')).toBeTruthy();
    });
  });
});
