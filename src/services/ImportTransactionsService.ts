import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const contacsReadStream = fs.createReadStream(filePath);

    const parsers = csvParse({
      delimiter: ',',
      from_line: 2,
    });

    const parseCSV = contacsReadStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });
    console.log({
      str: 'linha ExistentCategories -> categoriesRepository.find ',
      existentCategories,
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );
    console.log({
      str: 'linha existentCategoriesTitles ',
      existentCategoriesTitles,
    });

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    console.log({
      str: 'linha addCategoryTitles ',
      addCategoryTitles,
    });

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );
    console.log({
      str: 'linha newCategories ',
      newCategories,
    });

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];
    console.log({
      str: 'linha finalCategories ',
      finalCategories,
    });

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );
    console.log({
      str: 'linha createdTransactions ',
      createdTransactions,
    });

    await transactionsRepository.save(createdTransactions);

    console.log({
      str: 'linha createdTransactions apos save...... ',
      createdTransactions,
    });

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
